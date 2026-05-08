
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

const DEFAULT_SLEEP = settings.scanIntervalMs || 5000; 
const IDLE_WAIT = 15000;    
const MAX_QUEUE_LIMIT = 50000; 

// Карта для отслеживания последнего сканирования домена (Rate Limiting)
const lastScanByDomain = new Map<string, number>();

export async function startEngine() {
  console.log('==================================================');
  console.log('   HUMANGO BOT POLITE ENGINE v2.0                 ');
  console.log(`   User-Agent: ${settings.userAgent}            `);
  console.log('==================================================');
  
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', 'Движок вежливого сканирования запущен. RFC 9309 активен.');
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

      const url = new URL(task.url);
      const domain = url.hostname.toLowerCase();
      
      // 1. Дополнительный Rate Limiting на уровне домена (Polite Check)
      const lastScan = lastScanByDomain.get(domain) || 0;
      const now = Date.now();
      const timeSinceLastScan = now - lastScan;
      
      if (timeSinceLastScan < DEFAULT_SLEEP) {
        const wait = DEFAULT_SLEEP - timeSinceLastScan;
        console.log(`[Polite] Waiting ${wait}ms before next request to ${domain}`);
        await sleep(wait);
      }

      await saveBotEvent('START', `Политкорректный скан: ${domain}`);
      
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        lastScanByDomain.set(domain, Date.now()); // Обновляем время последнего сканирования
        
        if (result.status === 'failed') {
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
        
        // Экспоненциальный откат при ошибках сервера
        if (taskError.message.includes('RATE_LIMITED')) {
          console.log(`[Backoff] Server ${domain} is tired. Sleeping for 30s.`);
          await sleep(30000);
        }
      } finally {
        await updateQueueStatus(task.id, taskStatus);
      }

      // Глобальная пауза между задачами
      await sleep(DEFAULT_SLEEP);

    } catch (error: any) {
      console.error('[Engine Loop Error]', error.stack || error);
      await sleep(10000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
