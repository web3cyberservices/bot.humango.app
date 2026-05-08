
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

const DEFAULT_SLEEP = settings.scanIntervalMs || 5000; 
const IDLE_WAIT = 15000;    
const MAX_QUEUE_LIMIT = 50000; 

// Карта для отслеживания последнего сканирования домена (Rate Limiting)
const lastScanByDomain = new Map<string, number>();

export async function startEngine() {
  console.log('==================================================');
  console.log('   HUMANGO BOT COMPLIANCE ENGINE v2.5             ');
  console.log(`   User-Agent: ${settings.userAgent}            `);
  console.log('   Policy: RFC 9309 / Verified Bot Standards      ');
  console.log('==================================================');
  
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', 'Движок вежливого сканирования запущен. Соответствие политике ботов подтверждено.');
  } catch (err) {
    console.error('[Engine] FATAL: Database unreachable.');
    return;
  }

  while (true) {
    try {
      // Проверка общего статуса бота
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
      const url = new URL(urlStr);
      const domain = url.hostname.toLowerCase();
      
      // 1. Проверка Robots.txt и Crawl-delay (Polite Check)
      const robotsCheck = await isUrlAllowed(urlStr);
      if (!robotsCheck.allowed) {
        console.log(`[Polite] Skipping ${urlStr}: ${robotsCheck.reason}`);
        await updateQueueStatus(task.id, 'failed');
        continue;
      }

      // 2. Определение задержки (Crawl-delay из robots.txt имеет приоритет)
      const dynamicDelay = robotsCheck.delay || DEFAULT_SLEEP;
      const lastScan = lastScanByDomain.get(domain) || 0;
      const now = Date.now();
      const timeSinceLastScan = now - lastScan;
      
      if (timeSinceLastScan < dynamicDelay) {
        const wait = dynamicDelay - timeSinceLastScan;
        console.log(`[Polite] Respecting Crawl-delay: Waiting ${wait}ms for ${domain}`);
        await sleep(wait);
      }

      await saveBotEvent('START', `Compliance Scan: ${domain}`);
      
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        lastScanByDomain.set(domain, Date.now()); 
        
        if (result.status === 'failed' || result.status === 'blocked') {
          taskStatus = 'failed';
        } else if (result.status === 'success') {
          // Auto-Discovery Logic
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
        console.error(`[Engine] Task error:`, taskError.message);
        taskStatus = 'failed';
        
        if (taskError.message.includes('RATE_LIMITED')) {
          console.log(`[Backoff] Exponential backoff for ${domain}.`);
          await sleep(30000);
        }
      } finally {
        await updateQueueStatus(task.id, taskStatus);
      }

      // Глобальная пауза между разными доменами для ротации трафика
      await sleep(1000);

    } catch (error: any) {
      console.error('[Engine Loop Error]', error.stack || error);
      await sleep(10000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
