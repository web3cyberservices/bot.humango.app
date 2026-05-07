
'use server';

import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed, getCrawlDelay } from '@/config/robots-rules';
import { getBotStatus, saveAuditLog, saveBotEvent, saveAuditResults } from '@/lib/db';
import { CrawlResult, Violation } from '@/types';
import * as cheerio from 'cheerio';
import { z } from 'zod';

const urlSchema = z.string().url().refine((url) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  return !blockedHostnames.includes(hostname);
}, { message: "Internal/private addresses restricted." });

const BLACKLIST_KEYWORDS = ['google.', 'facebook.', 'amazon.', 'wikipedia.', 'linkedin.', 'microsoft.', 'apple.', 'twitter.', 'youtube.'];
const EU_LANGS = ['de', 'fr', 'it', 'es', 'pl', 'nl', 'da', 'fi', 'sv', 'pt', 'cs', 'hu', 'sk', 'sl', 'et', 'lv', 'lt', 'bg', 'ro', 'el'];

export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  const timestamp = new Date().toISOString();
  try {
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason: validation.error.errors[0].message };
    }

    const url = new URL(seedUrl);
    const domain = url.hostname.toLowerCase();

    if (BLACKLIST_KEYWORDS.some(kw => domain.includes(kw))) {
      return { url: seedUrl, timestamp, status: 'skipped', issuesFound: 0, scanType: 'basic', reason: 'Global giant domain blacklist.' };
    }

    const { allowed, reason } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      await saveAuditLog(domain, 403, reason || 'Blocked by robots.txt');
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason };
    }

    await new Promise(resolve => setTimeout(resolve, getCrawlDelay() * 1000));

    const { html, security, rawHeaders, scanType, dynamicCookies } = await scrapeUrl(seedUrl);
    
    // Lang Check for non-EU TLDs
    const isGlobalTld = ['.com', '.net', '.org'].some(tld => domain.endsWith(tld));
    if (isGlobalTld) {
      const $ = cheerio.load(html);
      const lang = $('html').attr('lang')?.toLowerCase()?.split('-')[0] || '';
      if (lang && !EU_LANGS.includes(lang)) {
         return { url: seedUrl, timestamp, status: 'skipped', issuesFound: 0, scanType: 'basic', reason: `Non-EU language: ${lang}` };
      }
    }

    const { violations, discoveredLinks } = parseHtmlContent(html, seedUrl, rawHeaders);
    
    // Dynamic Cookie Audit (GDPR)
    if (scanType === 'deep' && dynamicCookies && dynamicCookies.length > 0) {
      const trackers = ['fb', 'google', 'ads', 'analytics', 'pixel', 'intercom'];
      const suspicious = dynamicCookies.filter((c: any) => 
        trackers.some(key => c.name.toLowerCase().includes(key))
      );

      if (suspicious.length > 0) {
        violations.push({
          category: 'GDPR',
          issue_type: 'Нарушение конфиденциальности (динамические трекеры)',
          severity: 'high',
          evidence_html: 'Runtime Cookies: ' + suspicious.map(s => s.name).join(', '),
          snippet: 'Detected via headless browser rendering.',
          description: 'Detected tracking cookies set without consent.',
          law_name: 'EU GDPR / ePrivacy Directive',
          potential_fine: 'до €20 млн или 4% оборота',
          explanation: 'Обнаружены динамические трекеры и куки, которые устанавливаются автоматически при загрузке страницы без получения согласия пользователя.',
          recommendation: 'Настройте CMP для блокировки скриптов до момента получения согласия.'
        });
      }
    }

    await saveAuditLog(domain, 200, null);
    
    if (violations.length > 0) {
      await saveAuditResults(domain, seedUrl, violations, scanType);
      await saveBotEvent('SUCCESS', `Audit of ${domain} finished. ${violations.length} violations recorded.`);
    }

    return {
      url: seedUrl,
      timestamp,
      status: 'success',
      issuesFound: violations.length,
      violations,
      scanType,
      securityHeaders: security,
      discoveredLinks
    };
  } catch (error: any) {
    let d = 'unknown';
    try { d = new URL(seedUrl).hostname; } catch(e) {}
    await saveAuditLog(d, 500, error.message);
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', error: error.message };
  }
}
