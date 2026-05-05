import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed, getCrawlDelay } from '@/config/robots-rules';
import { saveScanResult } from './database';
import { getBotStatus } from '@/lib/db';
import { CrawlResult } from '@/types';

const recentlyScanned = new Set<string>();

/**
 * Точка входа для задачи сканирования.
 * Координирует работу скрапера, парсера и соблюдение правил.
 */
export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  try {
    // 0. Проверка статуса бота в БД перед началом
    const isActive = await getBotStatus();
    if (!isActive) {
      return { 
        url: seedUrl, 
        timestamp: new Date().toISOString(),
        status: 'skipped', 
        issuesFound: 0,
        reason: 'Движок краулера приостановлен администратором.' 
      };
    }

    const url = new URL(seedUrl);
    const domain = url.hostname;

    // 1. Проверка на дубликаты
    if (recentlyScanned.has(domain)) {
      return { 
        url: seedUrl, 
        timestamp: new Date().toISOString(),
        status: 'skipped', 
        issuesFound: 0,
        reason: 'Домен уже проверялся в текущем сеансе.' 
      };
    }

    // 2. Проверка Robots.txt (RFC 9309)
    const { allowed, reason } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      return { 
        url: seedUrl, 
        timestamp: new Date().toISOString(),
        status: 'blocked', 
        issuesFound: 0,
        reason 
      };
    }

    // 3. Задержка (Politeness)
    await new Promise(resolve => setTimeout(resolve, getCrawlDelay() * 1000));

    // 4. Запрос данных (Scraper)
    const { html, security } = await scrapeUrl(seedUrl);

    // 5. Анализ контента (Parser)
    const issues = parseHtmlContent(html, seedUrl);
    
    // Сохранение результатов
    await saveScanResult(seedUrl, issues);
    recentlyScanned.add(domain);

    return {
      url: seedUrl,
      timestamp: new Date().toISOString(),
      status: 'success',
      issuesFound: issues.length,
      issues: issues,
      securityHeaders: security
    };
  } catch (error: any) {
    console.error(`[Compliance Stop] ${seedUrl}:`, error.message);
    return { 
      url: seedUrl, 
      timestamp: new Date().toISOString(),
      status: 'failed', 
      issuesFound: 0,
      error: error.message 
    };
  }
}
