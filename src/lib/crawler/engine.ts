import { runCrawlTask } from './crawler';
import { 
  getBotStatus, 
  getNextQueueItem, 
  updateQueueStatus, 
  saveBotEvent, 
  addToQueue, 
  getQueueSize,
  cleanupOldLogs
} from '@/lib/db';

const SLEEP_INTERVAL = 1500; 
const IDLE_WAIT = 5000;    
const EMPTY_QUEUE_WAIT = 30000; 
const MAX_QUEUE_LIMIT = 5000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let errorBackoffMs = 1000;
let lastCleanupTime = 0;

export async function startEngine() {
  console.log('[Engine] HumangoBot Worker started.');
  await saveBotEvent('START', 'Движок HumangoBot инициализирован. Режим RFC 9309 активен.');

  while (true) {
    try {
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        await cleanupOldLogs(30);
        lastCleanupTime = now;
        await saveBotEvent('SUCCESS', 'Автоматическая очистка логов выполнена.');
      }

      const isActive = await getBotStatus();
      if (!isActive) {
        await sleep(IDLE_WAIT);
        continue;
      }

      errorBackoffMs = 1000;

      const queueSize = await getQueueSize();
      if (queueSize === 0) {
        console.log(`[Engine] Queue empty. Waiting ${EMPTY_QUEUE_WAIT / 1000}s...`);
        await sleep(EMPTY_QUEUE_WAIT);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(IDLE_WAIT);
        continue;
      }

      console.log(`[Engine] Processing: ${task.url}`);
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        
        if (result.status === 'failed') {
          taskStatus = 'failed';
        }

        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success' && result.discoveredLinks) {
           for (const link of result.discoveredLinks) {
             await addToQueue(link);
           }
        }
      } catch (taskError: any) {
        console.error(`[Engine] Task error for ${task.url}:`, taskError.message);
        taskStatus = 'failed';
      } finally {
        // Гарантированное обновление статуса
        await updateQueueStatus(task.id, taskStatus);
        console.log(`[DB] Status updated for ID: ${task.id} to ${taskStatus}`);
      }

      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error(`[Engine Critical] ${error.message}`);
      await sleep(errorBackoffMs);
      errorBackoffMs = Math.min(errorBackoffMs * 2, 60000); 
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
