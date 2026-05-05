import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed, getCrawlDelay } from '@/config/robots-rules';
import { saveScanResult } from './database';
import { getBotStatus } from '@/lib/db';
import { CrawlResult } from '@/types';
import { z } from 'zod';

const recentlyScanned = new Set<string>();

// Схема валидации URL для защиты от SSRF
const urlSchema = z.string().url().refine((url) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  
  // Запрещаем сканирование локальных и внутренних адресов
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(hostname);
  
  return !blockedHostnames.includes(hostname) && !isPrivateIp;
}, { message: "Internal or private addresses are restricted (SSRF Protection)" });

/**
 * Точка входа для задачи сканирования.
 */
export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  try {
    // 0. Валидация URL (Защита от SSRF)
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return {
        url: seedUrl,
        timestamp: new Date().toISOString(),
        status: 'blocked',
        issuesFound: 0,
        reason: validation.error.errors[0].message
      };
    }

    // 0.1 Проверка статуса бота в БД
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

    if (recentlyScanned.has(domain)) {
      return { 
        url: seedUrl, 
        timestamp: new Date().toISOString(),
        status: 'skipped', 
        issuesFound: 0,
        reason: 'Домен уже проверялся в текущем сеансе.' 
      };
    }

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

    await new Promise(resolve => setTimeout(resolve, getCrawlDelay() * 1000));

    const { html, security } = await scrapeUrl(seedUrl);
    const issues = parseHtmlContent(html, seedUrl);
    
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
