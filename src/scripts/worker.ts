
/**
 * @fileOverview Автономный воркер для фонового сканирования.
 * Запускается через PM2 или Docker как отдельный процесс.
 */

import * as dotenv from 'dotenv';
import { runCrawlTask } from '../lib/crawler/crawler';

dotenv.config();

const PREFIXES = ['cloud', 'web', 'data', 'smart', 'global', 'nexus', 'alpha', 'cyber', 'stream', 'dev'];
const SUFFIXES = ['node', 'grid', 'base', 'sync', 'point', 'hub', 'flow', 'core', 'labs', 'box'];
const TLDs = ['.com', '.net', '.org', '.io', '.app', '.tech'];

function generateRandomTarget(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const s = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const tld = TLDs[Math.floor(Math.random() * TLDs.length)];
  const rand = Math.floor(Math.random() * 999);
  return `https://${p}-${s}${rand}${tld}`;
}

async function startWorker() {
  console.log('--- HumangoBot Worker Started ---');
  console.log(`Targeting mode: Global Infrastructure Audit`);
  
  // Бесконечный цикл сканирования
  while (true) {
    const targetUrl = generateRandomTarget();
    console.log(`[Worker] Starting task for: ${targetUrl}`);
    
    try {
      const result = await runCrawlTask(targetUrl);
      
      if (result.status === 'success') {
        console.log(`[Worker] SUCCESS: Found ${result.issuesFound} issues on ${targetUrl}`);
      } else {
        console.log(`[Worker] SKIPPED/BLOCKED: ${targetUrl} - Reason: ${result.reason || result.status}`);
      }
    } catch (error: any) {
      console.error(`[Worker] FATAL ERROR during crawl: ${error.message}`);
    }

    // Пауза перед следующим доменом (RFC 9309 compliance)
    const delay = parseInt(process.env.CRAWL_DELAY || '5000', 10);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Обработка системных сигналов для корректного завершения
process.on('SIGINT', () => {
  console.log('[Worker] Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

startWorker();
