
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
const IDLE_WAIT = 30000;    
const MAX_QUEUE_LIMIT = 5000;

export async function startEngine() {
  console.log('[Engine] HumangoBot Engine starting...');
  
  // Initial sanity check
  try {
    await testConnection();
    await saveBotEvent('SUCCESS', 'Движок HumangoBot запущен. Связь с БД установлена.');
  } catch (err) {
    console.error('[Engine] FATAL: Database unreachable. Check DATABASE_URL.');
    return;
  }

  while (true) {
    try {
      // Heartbeat
      console.log(`[Engine] Cycle heartbeat at ${new Date().toLocaleTimeString()}`);
      
      // Forced start: ignoring pause settings as requested by user
      console.log('[Engine] Forced start: ignoring pause settings.');
      const isActive = true; // Hardcoded to true to bypass DB check if table is missing
      
      /* 
      // Original check disabled to prevent blocking if table 'bot_settings' is missing
      const isActive = await getBotStatus();
      if (!isActive) {
        console.log('[Engine] Engine is paused by settings.');
        await sleep(IDLE_WAIT);
        continue;
      }
      */

      const task = await getNextQueueItem();
      
      if (!task) {
        console.log('[Engine] Queue is empty. Waiting for new tasks...');
        await sleep(IDLE_WAIT); 
        continue;
      }

      console.log(`[Engine] Processing task: ${task.url}`);
      let taskStatus: 'completed' | 'failed' = 'completed';

      try {
        const result = await runCrawlTask(task.url);
        
        if (result.status === 'failed') {
          taskStatus = 'failed';
          console.error(`[Engine] Task failed for ${task.url}: ${result.error || 'Unknown error'}`);
        }

        // Auto-discovery logic
        const queueSize = await getQueueSize();
        if (queueSize < MAX_QUEUE_LIMIT && result.status === 'success' && result.discoveredLinks) {
           for (const link of result.discoveredLinks) {
             await addToQueue(link);
           }
        }
      } catch (taskError: any) {
        console.error(`[Engine] Unexpected error during crawl:`, taskError.message);
        taskStatus = 'failed';
      } finally {
        await updateQueueStatus(task.id, taskStatus);
        console.log(`[Engine] Task finished: ${task.url} -> ${taskStatus}`);
      }

      await sleep(SLEEP_INTERVAL);

    } catch (error: any) {
      console.error('[Engine Loop CRITICAL ERROR]', error.stack || error);
      await sleep(5000); // Backoff
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
