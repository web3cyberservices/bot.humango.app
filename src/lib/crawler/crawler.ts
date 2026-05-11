
'use server';

import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed } from '@/config/robots-rules';
import { saveAuditLog, saveBotEvent, saveAuditResults } from '@/lib/db';
import { CrawlResult, Violation } from '@/types';
import { z } from 'zod';
import { performance } from 'perf_hooks';

const urlSchema = z.string().url();

/**
 * Memory Guard: Prevents OOM on limited RAM (8GB)
 */
async function checkResources() {
  const memory = process.memoryUsage();
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  
  if (heapUsedMB > 1024) { // > 1GB
    if (global.gc) {
      global.gc();
    } else {
      console.warn('[MemoryGuard] High heap usage detected. No global.gc, waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return heapUsedMB;
}

/**
 * Master Orchestrator: runAudit logic
 */
export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    // 1. Resource & URL Check
    const ramStart = await checkResources();
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason: 'Invalid URL' };
    }

    // 2. Robots.txt Compliance (RFC 9309)
    const { allowed, reason } = await isUrlAllowed(seedUrl);
    if (!allowed) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason };
    }

    // 3. Phase 1: SPEED (Fetch) & Phase 2: BRUTEFORCE (Puppeteer)
    // The scrapeUrl internal logic handles escalation based on SPA/WAF/Missing Links
    const scrape = await scrapeUrl(seedUrl);
    
    if (scrape.status === 'fail') {
      const errorMsg = scrape.rawHeaders?.['x-waf-block'] ? 'WAF_BLOCK: Manual review required' : 'Failed to retrieve content';
      return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: errorMsg };
    }

    // 4. Diagnostic Modules (NAV-SCOUT & LEX-ANALYZER)
    const { violations, discoveredLinks, meta, compliance_report } = parseHtmlContent(
      scrape.html, 
      seedUrl, 
      scrape.rawHeaders, 
      scrape.screenshot
    );

    // 5. SSL / Security Enforcement
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

    // 6. Persistence & Events
    const domain = new URL(seedUrl).hostname;
    await saveAuditLog(domain, 200, null);
    await saveAuditResults(domain, seedUrl, violations, scrape.method === 'puppeteer' ? 'deep' : 'basic');
    
    const ramEnd = await checkResources();
    const total_ms = Math.round(performance.now() - startTime);

    await saveBotEvent('SUCCESS', `Audit finished: ${domain} | Score: ${compliance_report.score}% | Issues: ${violations.length} | RAM: ${ramEnd}MB`);

    // 7. Final Output (Ahmad-spec format)
    return {
      url: seedUrl,
      timestamp,
      status: 'success',
      issuesFound: violations.length,
      violations,
      compliance_report,
      scanType: scrape.method === 'puppeteer' ? 'deep' : 'basic',
      discoveredLinks,
      meta: {
        duration_ms: total_ms,
        memory_usage_mb: ramEnd,
        method: scrape.method,
        hasCMP: meta.hasCMP,
        legal_links: meta.legal_links
      }
    };
  } catch (error: any) {
    const errorType = error.message.includes('TIMEOUT') ? 'ERR_CONNECTION_TIMED_OUT' : 
                     error.message.includes('CERT') ? 'ERR_CERT_INVALID' : 'CRITICAL_ERROR';
    
    await saveBotEvent('ERROR', `Audit Crash [${seedUrl}]: ${errorType} - ${error.message}`);
    
    return { 
      url: seedUrl, 
      timestamp, 
      status: 'failed', 
      issuesFound: 0, 
      scanType: 'basic', 
      error: errorType,
      reason: error.message 
    };
  }
}
