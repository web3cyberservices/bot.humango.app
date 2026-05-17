
'use server';

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

const IDLE_WAIT = 15000;    

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWorker(workerId: number) {
  logger.info(`[Worker ${workerId}] V33.0 Priority Engine Active.`);
  
  while (true) {
    let currentTaskId: number | null = null;
    let currentDomain: string = 'unknown';

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

      currentTaskId = task.id;
      const urlStr = task.url;
      const userEmail = task.user_email;
      
      try {
        const url = new URL(urlStr);
        currentDomain = url.hostname.toLowerCase();
      } catch (e: any) {
        logger.error(`[Worker ${workerId}] Invalid URL in task: ${urlStr}`);
        await updateQueueStatus(task.id, 'failed');
        continue;
      }
      
      const robotsCheck = await isUrlAllowed(urlStr);
      if (!robotsCheck.allowed) {
        logger.warn(`[Worker ${workerId}] URL blocked by robots.txt: ${urlStr}`);
        await updateQueueStatus(task.id, 'failed');
        continue;
      }

      logger.info(`[Worker ${workerId}] Starting prioritized audit: ${currentDomain}`);
      await saveBotEvent('START', `Compliance Scan [Worker ${workerId}]: ${currentDomain}`);
      
      // Perform the crawl
      const result = await runCrawlTask(task.url);
      
      if (result.status === 'success') {
        if (userEmail) {
          logger.info(`[Worker ${workerId}] Scan complete for ${currentDomain}. Sending Email to ${userEmail}...`);
          try {
            const emailSent = await sendAuditEmail(currentDomain, userEmail);
            if (!emailSent) {
              logger.error(`[Worker ${workerId}] Email delivery failed for ${currentDomain}, but scan succeeded.`);
            }
          } catch (emailErr: any) {
            logger.error(`[Worker ${workerId}] Error in sendAuditEmail: ${emailErr.message}`);
          }
        }
        await updateQueueStatus(task.id, 'completed');
        await saveBotEvent('SUCCESS', `Audit completed successfully for ${currentDomain}`);
      } else {
        logger.error(`[Worker ${workerId}] Crawl failed for ${currentDomain}: ${result.reason}`);
        await updateQueueStatus(task.id, 'failed');
        await saveBotEvent('ERROR', `Audit failed for ${currentDomain}: ${result.reason}`);
      }

    } catch (error: any) {
      logger.error(`[Worker ${workerId}] Engine Loop Error: ${error.message}`);
      if (currentTaskId) {
        await updateQueueStatus(currentTaskId, 'failed').catch(() => {});
      }
      await sleep(10000);
    }
    
    await sleep(1000);
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
