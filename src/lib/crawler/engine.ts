
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

const SLEEP_INTERVAL = 1500; 
const IDLE_WAIT = 10000;    
const MAX_QUEUE_LIMIT = 100000; 

export async function startEngine() {
  console.log('[Engine] HumangoBot EU Compliance Engine starting with Auto-Discovery...');
  
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', 'Движок HumangoBot запущен. Режим Auto-Discovery активен.');
  } catch (err) {
    console.error('[Engine] FATAL: Database unreachable.');
    return;
  }

  while (true) {
    try {
      const task = await getNextQueueItem();
      
      if (!task) {
        console.log('[Engine] Queue is empty. Waiting...');
        await sleep(IDLE_WAIT); 
        continue;
      }

      const domain = new URL(task.url).hostname;
      await saveBotEvent('START', `Начинаю сканирование: ${domain} (глубина: ${task.depth})`);
      
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        
        if (result.status === 'failed') {
          taskStatus = 'failed';
          await saveBotEvent('ERROR', `Ошибка сканирования ${domain}: ${result.error}`);
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
        await saveBotEvent('ERROR', `Критический сбой задачи ${domain}`);
      } finally {
        await updateQueueStatus(task.id, taskStatus);
      }

      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error('[Engine Loop Error]', error.stack || error);
      await sleep(5000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
