
'use server';

import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed } from '@/config/robots-rules';
import { saveAuditLog, saveBotEvent, saveAuditResults } from '@/lib/db';
import { CrawlResult, Violation } from '@/types';
import { z } from 'zod';

const urlSchema = z.string().url();

export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  const timestamp = new Date().toISOString();
  try {
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason: 'Invalid URL' };
    }

    const { allowed, reason, delay } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason };
    }

    // High-Performance Scrape (Fetch -> Puppeteer)
    const scrape = await scrapeUrl(seedUrl);
    if (scrape.status === 'fail') {
      return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: 'Failed to retrieve content' };
    }

    // Advanced Parse (NAV-SCOUT & LEX-ANALYZER)
    const { violations, discoveredLinks, meta } = parseHtmlContent(scrape.html, seedUrl, scrape.rawHeaders, scrape.screenshot);

    // SSL & Security Checks
    if (!seedUrl.startsWith('https:')) {
      violations.push({
        category: 'Security',
        report_type: 'Manual',
        issue_type: 'Insecure Connection',
        severity: 'critical',
        evidence_html: seedUrl,
        description: 'The website transmits data over unencrypted HTTP. This exposes all user data to sniffing.',
        law_name: 'GDPR Art. 32',
        potential_fine: '€2,500 - €20,000,000',
        explanation: 'Security of processing is mandatory. Lack of SSL is a direct violation of Art. 32 GDPR.',
        recommendation: 'Deploy an SSL certificate and force HTTPS redirection.'
      });
    }

    // Finalize results
    const domain = new URL(seedUrl).hostname;
    await saveAuditLog(domain, 200, null);
    
    if (violations.length > 0) {
      await saveAuditResults(domain, seedUrl, violations, scrape.method === 'puppeteer' ? 'deep' : 'basic');
      await saveBotEvent('SUCCESS', `Audit finished: ${domain} | Method: ${scrape.method} | Issues: ${violations.length}`);
    }

    return {
      url: seedUrl,
      timestamp,
      status: 'success',
      issuesFound: violations.length,
      violations,
      scanType: scrape.method === 'puppeteer' ? 'deep' : 'basic',
      discoveredLinks,
      meta: {
        duration_ms: scrape.duration_ms,
        memory_usage_mb: scrape.memory_usage_mb,
        method: scrape.method,
        hasCMP: meta.hasCMP,
        legal_links: meta.legal_links
      }
    };
  } catch (error: any) {
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', error: error.message };
  }
}
