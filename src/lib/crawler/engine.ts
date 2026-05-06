/**
 * @fileOverview Основной координатор краулера.
 * Управляет циклом работы, обработкой ошибок БД, очередью и очисткой логов.
 */

import { runCrawlTask } from './crawler';
import { 
  getBotStatus, 
  getNextQueueItem, 
  removeFromQueue, 
  saveBotEvent, 
  addToQueue, 
  getQueueSize,
  cleanupOldLogs,
  saveAuditLog
} from '@/lib/db';
import { VIOLATION_TYPES } from '../parser';

const SLEEP_INTERVAL = 1500; 
const IDLE_WAIT = 5000;    
const MAX_QUEUE_LIMIT = 5000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 часа

let errorBackoffMs = 1000;
let lastCleanupTime = 0;

export async function startEngine() {
  await saveBotEvent('START', 'Движок HumangoBot инициализирован и перешел в режим мониторинга очереди.');

  while (true) {
    try {
      // 1. Проверка на необходимость очистки старых логов (Retention Policy)
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        await cleanupOldLogs(30);
        lastCleanupTime = now;
        await saveBotEvent('SUCCESS', 'Автоматическая очистка старых логов (30 дней) завершена успешно.');
      }

      // 2. Проверка статуса бота
      const isActive = await getBotStatus();
      errorBackoffMs = 1000;

      if (!isActive) {
        await sleep(IDLE_WAIT);
        continue;
      }

      // 3. Управление очередью
      const queueSize = await getQueueSize();
      if (queueSize === 0) {
        const placeholderTarget = generateDiscoveryTarget();
        await addToQueue(placeholderTarget);
        await sleep(IDLE_WAIT);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(IDLE_WAIT);
        continue;
      }

      // 4. Выполнение задачи
      try {
        const result = await runCrawlTask(task.url);
        
        // Обработка специфической ошибки Redirect Loop
        if (result.error === 'REDIRECT_LOOP') {
          const domain = new URL(task.url).hostname;
          await saveAuditLog(domain, 310, 'Обнаружен бесконечный редирект (Redirect Loop)');
          await saveBotEvent('ERROR', `Сайт ${domain} заблокирован: превышено кол-во редиректов (5).`);
        }

        // 5. Discovery (если всё ок)
        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success') {
           await addToQueue(generateDiscoveryTarget());
        }
      } finally {
        // Удаляем задачу из очереди в любом случае
        await removeFromQueue(task.id);
      }

      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error(`[Engine Critical] ${error.message}`);
      
      try {
        await saveBotEvent('ERROR', `Критический сбой цикла: ${error.message}. Повтор через ${errorBackoffMs/1000}с.`);
      } catch (e) {}

      await sleep(errorBackoffMs);
      errorBackoffMs = Math.min(errorBackoffMs * 2, 60000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateDiscoveryTarget(): string {
  const clusters = ['alpha', 'beta', 'gamma', 'delta', 'omega'];
  const tlds = ['.com', '.net', '.org', '.io', '.app'];
  const id = Math.floor(Math.random() * 1000);
  const cluster = clusters[Math.floor(Math.random() * clusters.length)];
  const tld = tlds[Math.floor(Math.random() * tlds.length)];
  return `https://${cluster}-node-${id}${tld}`;
}