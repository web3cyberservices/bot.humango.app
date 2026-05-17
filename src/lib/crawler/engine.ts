
import { runCrawlTask } from './crawler';
import { 
  getBotStatus, 
  getNextQueueItem, 
  updateQueueStatus, 
  saveBotEvent, 
  testConnection
} from '@/lib/db';
import settings from '@/config/crawler-settings.json';
import { isUrlAllowed } from '@/config/robots-rules';
import { logger } from '../logger';
import { sendAuditEmail } from '../email';

const DEFAULT_SLEEP = settings.scanIntervalMs || 5000; 
const IDLE_WAIT = 15000;    

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWorker(workerId: number) {
  logger.info(`[Worker ${workerId}] V33.0 Priority Engine Active.`);
  
  while (true) {
    try {
      const active = await getBotStatus();
      if (!active) {
        await sleep(5000);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(IDLE_WAIT); 
        continue;
      }

      const urlStr = task.url;
      const userEmail = task.user_email;
      let domain = '';
      try {
        const url = new URL(urlStr);
        domain = url.hostname.toLowerCase();
      } catch (e: any) {
        await updateQueueStatus(task.id, 'failed');
        continue;
      }
      
      const robotsCheck = await isUrlAllowed(urlStr);
      if (!robotsCheck.allowed) {
        await updateQueueStatus(task.id, 'failed');
        continue;
      }

      logger.info(`[Worker ${workerId}] Starting prioritized audit: ${domain}`);
      await saveBotEvent('START', `Compliance Scan [Worker ${workerId}]: ${domain}`);
      
      try {
        const result = await runCrawlTask(task.url);
        
        if (result.status === 'success' && userEmail) {
          logger.info(`[Worker ${workerId}] Scan complete for ${domain}. Generating PDF and Sending Email...`);
          // We trigger the email sending which will fetch the PDF via internal call or shared util
          await sendAuditEmail(domain, userEmail);
        }

        await updateQueueStatus(task.id, 'completed');
      } catch (taskError: any) {
        logger.error(`[Worker ${workerId}] Task error for ${domain}: ${taskError.message}`);
        await updateQueueStatus(task.id, 'failed');
      }

      await sleep(1000);
    } catch (error: any) {
      logger.error(`[Worker ${workerId}] Engine Loop Error: ${error.message}`);
      await sleep(10000);
    }
  }
}

export async function startEngine() {
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', `Engine started with ${settings.maxConcurrency} workers.`);
  } catch (err: any) {
    logger.error(`FATAL: Database unreachable: ${err.message}`);
    return;
  }

  const concurrency = settings.maxConcurrency || 1;
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(runWorker(i + 1));
  }
  await Promise.all(workers);
}
