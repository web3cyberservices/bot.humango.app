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

  // Бесконечный цикл — бот никогда не завершает процесс самостоятельно
  while (true) {
    try {
      // 1. Retention Policy Check (раз в сутки)
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        await cleanupOldLogs(30);
        lastCleanupTime = now;
        await saveBotEvent('SUCCESS', 'Автоматическая очистка логов (30 дней) выполнена.');
      }

      // 2. Control Check (проверка флага активности в БД)
      const isActive = await getBotStatus();
      if (!isActive) {
        console.log('[Engine] Bot is paused via settings. Checking again in 5s...');
        await sleep(IDLE_WAIT);
        continue;
      }

      errorBackoffMs = 1000; // Сброс ошибки при успешном доступе к БД

      // 3. Queue Management
      const queueSize = await getQueueSize();
      if (queueSize === 0) {
        console.log(`[Engine] Queue is empty. Waiting ${EMPTY_QUEUE_WAIT / 1000}s for new tasks...`);
        // Вместо выхода из программы, просто засыпаем на 30 секунд и проверяем снова
        await sleep(EMPTY_QUEUE_WAIT);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(IDLE_WAIT);
        continue;
      }

      // 4. Task Execution
      console.log(`[Engine] Processing: ${task.url}`);
      try {
        const result = await runCrawlTask(task.url);
        
        // 5. Discovery Mechanism
        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success' && result.discoveredLinks) {
           for (const link of result.discoveredLinks) {
             await addToQueue(link);
           }
        }
      } catch (taskError: any) {
        console.error(`[Engine] Task failed for ${task.url}:`, taskError.message);
        await saveBotEvent('ERROR', `Ошибка при обработке ${task.url}: ${taskError.message}`);
      } finally {
        // Гарантированное удаление из очереди, чтобы не зацикливаться на битых задачах
        await removeFromQueue(task.id);
      }

      // Стандартная пауза между успешными запросами
      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error(`[Engine Critical] Database or Runtime Error: ${error.message}`);
      // Экспоненциальная пауза при ошибках (например, если упала БД)
      await sleep(errorBackoffMs);
      errorBackoffMs = Math.min(errorBackoffMs * 2, 60000); 
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
