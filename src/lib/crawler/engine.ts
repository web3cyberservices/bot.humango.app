
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

      // Поиск задач в БД
      console.log('[Engine] Searching for pending tasks in scan_queue...');
      const task = await getNextQueueItem();

      if (!task) {
        console.log('[Engine] No tasks. Waiting 30s...');
        await sleep(30000); // Ожидание 30 секунд при пустой очереди
        continue;
      }

      // Если задача найдена, начинаем сканирование
      console.log(`[Engine] Processing: ${task.url} (ID: ${task.id})`);
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        
        if (result.status === 'failed') {
          taskStatus = 'failed';
        }

        const queueSize = await getQueueSize();
        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success' && result.discoveredLinks) {
           for (const link of result.discoveredLinks) {
             await addToQueue(link);
           }
        }
      } catch (taskError: any) {
        console.error(`[Engine] Task error for ${task.url}:`, taskError.message);
        taskStatus = 'failed';
      } finally {
        // Обновляем статус на финальный в блоке finally
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
