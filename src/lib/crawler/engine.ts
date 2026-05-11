
import { runCrawlTask } from './crawler';
import { 
  getBotStatus, 
  getNextQueueItem, 
  updateQueueStatus, 
  saveBotEvent, 
  addToQueue, 
  getQueueSize,
  testConnection
} from '@/lib/db';
import settings from '@/config/crawler-settings.json';
import { isUrlAllowed } from '@/config/robots-rules';
import { logger } from '../logger';

const DEFAULT_SLEEP = settings.scanIntervalMs || 5000; 
const IDLE_WAIT = 15000;    
const MAX_QUEUE_LIMIT = 50000; 

// Shared state across all worker threads in this process
const lastScanByDomain = new Map<string, number>();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWorker(workerId: number) {
  logger.info(`[Worker ${workerId}] Bootstrapped and monitoring queue.`);
  
  while (true) {
    try {
      const active = await getBotStatus();
      if (!active) {
        await sleep(5000);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        // No tasks in queue, wait before checking again
        await sleep(IDLE_WAIT); 
        continue;
      }

      const urlStr = task.url;
      let domain = '';
      try {
        const url = new URL(urlStr);
        domain = url.hostname.toLowerCase();
      } catch (e) {
        logger.error(`[Worker ${workerId}] Invalid URL in queue: ${urlStr}`);
        await updateQueueStatus(task.id, 'failed');
        continue;
      }
      
      const robotsCheck = await isUrlAllowed(urlStr);
      if (!robotsCheck.allowed) {
        logger.info(`[Worker ${workerId}] [Polite] Skipping ${urlStr}: ${robotsCheck.reason}`);
        await updateQueueStatus(task.id, 'failed');
        continue;
      }

      // Politeness: Check if we need to wait for this specific domain
      const dynamicDelay = robotsCheck.delay || DEFAULT_SLEEP;
      const lastScan = lastScanByDomain.get(domain) || 0;
      const now = Date.now();
      const timeSinceLastScan = now - lastScan;
      
      if (timeSinceLastScan < dynamicDelay) {
        const wait = dynamicDelay - timeSinceLastScan;
        logger.info(`[Worker ${workerId}] [Polite] Respecting Crawl-delay for ${domain}: Waiting ${wait}ms`);
        await sleep(wait);
      }

      logger.info(`[Worker ${workerId}] Starting audit: ${domain}`);
      await saveBotEvent('START', `Compliance Scan [Worker ${workerId}]: ${domain}`);
      
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        
        // Update shared domain timestamp after successful or failed attempt
        lastScanByDomain.set(domain, Date.now()); 
        
        if (result.status === 'failed' || result.status === 'blocked') {
          taskStatus = 'failed';
        } else if (result.status === 'success') {
          // If the scan found more links and we aren't over the limit, add them to queue
          if (result.discoveredLinks && result.discoveredLinks.length > 0) {
            const currentQueueSize = await getQueueSize();
            if (currentQueueSize < MAX_QUEUE_LIMIT) {
              for (const link of result.discoveredLinks) {
                await addToQueue(link, task.depth + 1, 1); 
              }
            }
          }
        }
      } catch (taskError: any) {
        logger.error(`[Worker ${workerId}] Task error for ${domain}: ${taskError.message}`);
        taskStatus = 'failed';
        
        if (taskError.message.includes('RATE_LIMITED')) {
          const retryMatch = taskError.message.match(/_RETRY_(\d+)/);
          const waitSeconds = retryMatch ? parseInt(retryMatch[1], 10) : 30;
          logger.warn(`[Worker ${workerId}] [Backoff] Server requested wait: ${waitSeconds}s for ${domain}.`);
          await saveBotEvent('ERROR', `Rate Limit for ${domain}. Waiting ${waitSeconds}s.`);
          await sleep(waitSeconds * 1000);
        }
      } finally {
        await updateQueueStatus(task.id, taskStatus);
      }

      // Brief pause between tasks for this worker
      await sleep(1000);
    } catch (error: any) {
      logger.error(`[Worker ${workerId}] Engine Loop Error: ${error.message}`);
      await sleep(10000);
    }
  }
}

export async function startEngine() {
  logger.info('==================================================');
  logger.info('   HUMANGO BOT COMPLIANCE ENGINE v2.9             ');
  logger.info(`   Concurrency: ${settings.maxConcurrency} parallel workers  `);
  logger.info(`   User-Agent: ${settings.userAgent}            `);
  logger.info('==================================================');
  
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', `Движок запущен с параллельностью ${settings.maxConcurrency}.`);
  } catch (err) {
    logger.error('FATAL: Database unreachable.');
    return;
  }

  const concurrency = settings.maxConcurrency || 1;
  const workers = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push(runWorker(i + 1));
  }

  // Workers run forever
  await Promise.all(workers);
}
