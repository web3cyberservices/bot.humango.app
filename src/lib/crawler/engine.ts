/**
 * @fileOverview Основной координатор краулера HumangoBot.
 * Управляет циклом работы, очередью, Discovery и автоматической очисткой БД.
 */

import { runCrawlTask } from './crawler';
import { 
  getBotStatus, 
  getNextQueueItem, 
  removeFromQueue, 
  saveBotEvent, 
  addToQueue, 
  getQueueSize,
  cleanupOldLogs
} from '@/lib/db';

const SLEEP_INTERVAL = 1500; 
const IDLE_WAIT = 5000;    
const EMPTY_QUEUE_WAIT = 30000; // 30 секунд ожидания при пустой очереди
const MAX_QUEUE_LIMIT = 5000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 часа

let errorBackoffMs = 1000;
let lastCleanupTime = 0;

export async function startEngine() {
  console.log('[Engine] HumangoBot Worker started.');
  await saveBotEvent('START', 'Движок HumangoBot инициализирован. Режим RFC 9309 активен.');

  while (true) {
    try {
      // 1. Retention Policy Check
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        await cleanupOldLogs(30);
        lastCleanupTime = now;
        await saveBotEvent('SUCCESS', 'Автоматическая очистка логов (30 дней) выполнена.');
      }

      // 2. Control Check (проверка флага активности в БД)
      const isActive = await getBotStatus();
      if (!isActive) {
        await sleep(IDLE_WAIT);
        continue;
      }

      errorBackoffMs = 1000; // Сброс ошибки при успешном доступе к БД

      // 3. Queue Management
      const queueSize = await getQueueSize();
      if (queueSize === 0) {
        console.log('[Engine] Queue is empty. Sleeping for 30s...');
        // Вместо выхода из программы, просто засыпаем на 30 секунд
        await sleep(EMPTY_QUEUE_WAIT);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(IDLE_WAIT);
        continue;
      }

      // 4. Task Execution
      try {
        const result = await runCrawlTask(task.url);
        
        // 5. Discovery Mechanism
        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success' && result.discoveredLinks) {
           for (const link of result.discoveredLinks) {
             await addToQueue(link);
           }
        }
      } finally {
        // Гарантированное удаление из очереди для предотвращения блокировок
        await removeFromQueue(task.id);
      }

      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error(`[Engine Critical] ${error.message}`);
      await sleep(errorBackoffMs);
      errorBackoffMs = Math.min(errorBackoffMs * 2, 60000); // Экспоненциальная пауза при ошибках БД
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
