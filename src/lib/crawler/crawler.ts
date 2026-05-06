import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed, getCrawlDelay } from '@/config/robots-rules';
import { getBotStatus, saveAuditLog, saveBotEvent, saveScanIssueToDb } from '@/lib/db';
import { CrawlResult } from '@/types';
import { z } from 'zod';

const recentlyScanned = new Set<string>();

const urlSchema = z.string().url().refine((url) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(hostname);
  
  return !blockedHostnames.includes(hostname) && !isPrivateIp;
}, { message: "Internal/private addresses restricted (SSRF Protection)" });

export async function runCrawlTask(seedUrl: string): Promise<CrawlResult & { discoveredLinks?: string[] }> {
  const timestamp = new Date().toISOString();
  try {
    // 1. SSRF & URL Validation
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      const errorMsg = validation.error.errors[0].message;
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, reason: errorMsg };
    }

    // 2. Active Check
    const isActive = await getBotStatus();
    if (!isActive) {
      return { url: seedUrl, timestamp, status: 'skipped', issuesFound: 0, reason: 'Engine paused.' };
    }

    const url = new URL(seedUrl);
    const domain = url.hostname;

    // 3. Frequency & Robots.txt Check
    const { allowed, reason } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      await saveAuditLog(domain, 403, reason || 'Blocked by robots.txt');
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, reason };
    }

    // 4. Politeness Delay
    const delay = getCrawlDelay() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // 5. Scrape & Parse
    const { html, security } = await scrapeUrl(seedUrl);
    const { issues, discoveredLinks } = parseHtmlContent(html, seedUrl);
    
    // 6. DB Saving
    await saveAuditLog(domain, 200, null);
    if (issues.length > 0) {
      for (const issue of issues) {
        await saveScanIssueToDb(domain, issue);
      }
      await saveBotEvent('SUCCESS', `Сканирование ${domain} завершено. Найдено нарушений: ${issues.length}`);
    }

    return {
      url: seedUrl,
      timestamp,
      status: 'success',
      issuesFound: issues.length,
      issues,
      securityHeaders: security,
      discoveredLinks
    };
  } catch (error: any) {
    let domain = 'unknown';
    try { domain = new URL(seedUrl).hostname; } catch(e) {}
    
    await saveAuditLog(domain, 500, error.message);
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, error: error.message };
  }
}
