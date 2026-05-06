import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed, getCrawlDelay } from '@/config/robots-rules';
import { saveScanResult } from './database';
import { getBotStatus, saveAuditLog, saveBotEvent } from '@/lib/db';
import { CrawlResult } from '@/types';
import { z } from 'zod';

const recentlyScanned = new Set<string>();

const urlSchema = z.string().url().refine((url) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(hostname);
  
  return !blockedHostnames.includes(hostname) && !isPrivateIp;
}, { message: "Internal or private addresses are restricted (SSRF Protection)" });

export async function runCrawlTask(seedUrl: string): Promise<CrawlResult & { discoveredLinks?: string[] }> {
  const timestamp = new Date().toISOString();
  try {
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      const errorMsg = validation.error.errors[0].message;
      await saveBotEvent('ERROR', `Блокировка URL ${seedUrl}: ${errorMsg}`);
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, reason: errorMsg };
    }

    const isActive = await getBotStatus();
    if (!isActive) {
      return { url: seedUrl, timestamp, status: 'skipped', issuesFound: 0, reason: 'Движок приостановлен.' };
    }

    const url = new URL(seedUrl);
    const domain = url.hostname;

    if (recentlyScanned.has(domain)) {
      return { url: seedUrl, timestamp, status: 'skipped', issuesFound: 0, reason: 'Уже просканировано.' };
    }

    const { allowed, reason } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      await saveAuditLog(domain, 403, reason || 'Blocked by robots.txt');
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, reason };
    }

    const delay = getCrawlDelay() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const { html, security } = await scrapeUrl(seedUrl);
    const { issues, discoveredLinks } = parseHtmlContent(html, seedUrl);
    
    await saveScanResult(seedUrl, issues);
    await saveAuditLog(domain, 200, null);
    
    if (issues.length > 0) {
      await saveBotEvent('SUCCESS', `Сканирование ${domain} завершено. Найдено нарушений: ${issues.length}`);
    }

    recentlyScanned.add(domain);
    if (recentlyScanned.size > 1000) recentlyScanned.clear();

    return {
      url: seedUrl,
      timestamp,
      status: 'success',
      issuesFound: issues.length,
      issues: issues,
      securityHeaders: security,
      discoveredLinks
    };
  } catch (error: any) {
    let domain = 'unknown';
    try { domain = new URL(seedUrl).hostname; } catch(e) {}
    
    await saveAuditLog(domain, 500, error.message);
    if (error.message === 'REDIRECT_LOOP') {
       return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, error: 'REDIRECT_LOOP' };
    }
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, error: error.message };
  }
}
