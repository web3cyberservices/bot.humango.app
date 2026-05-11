
import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent, normalizeUrl } from '@/lib/parser';
import { isUrlAllowed } from '@/config/robots-rules';
import { saveAuditLog, saveBotEvent, saveAuditResults } from '@/lib/db';
import { CrawlResult, Violation, VerificationMethod } from '@/types';
import { z } from 'zod';
import { performance } from 'perf_hooks';

const urlSchema = z.string().url();

async function checkResources() {
  const memory = process.memoryUsage();
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  // Simple check for high memory
  if (heapUsedMB > 1200) { 
    if (global.gc) {
      global.gc();
    }
  }
  return heapUsedMB;
}

export async function runCrawlTask(seedUrl: string): Promise<CrawlResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    await checkResources();
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return { url: seedUrl, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason: 'Invalid URL' };
    }

    const initialNormalized = normalizeUrl(seedUrl, seedUrl) || seedUrl;

    const { allowed, reason } = await isUrlAllowed(initialNormalized);
    if (!allowed) {
      return { url: initialNormalized, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason };
    }

    const scrape = await scrapeUrl(initialNormalized);
    if (scrape.status === 'fail') {
      const errorMsg = scrape.rawHeaders?.['x-waf-block'] ? 'WAF_BLOCK: Manual review required' : 'Failed to retrieve content';
      return { url: initialNormalized, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: errorMsg };
    }

    const isDeep = scrape.method === 'puppeteer';
    const verification_method: VerificationMethod = isDeep ? 'Dynamic Emulation' : 'Static Analysis';

    const { violations, meta, compliance_report } = parseHtmlContent(
      scrape.html, 
      initialNormalized, 
      scrape.rawHeaders, 
      scrape.screenshot,
      isDeep
    );

    // Filter and Deduplicate Violations
    const uniqueViolationsMap = new Map();
    violations.forEach(v => {
      // Normalize affected URL
      const normalizedEvidence = normalizeUrl(v.evidence_html, initialNormalized) || v.evidence_html;
      v.evidence_html = normalizedEvidence;
      
      const key = `${v.issue_type}_${v.evidence_html}`;
      if (!uniqueViolationsMap.has(key)) {
        uniqueViolationsMap.set(key, v);
      }
    });

    const finalViolations = Array.from(uniqueViolationsMap.values());
    const domain = new URL(initialNormalized).hostname;
    
    await saveAuditLog(domain, 200, null);
    await saveAuditResults(domain, initialNormalized, finalViolations, isDeep ? 'deep' : 'basic');
    
    const total_ms = Math.round(performance.now() - startTime);

    await saveBotEvent('SUCCESS', `Audit finished: ${domain} | Verdict: ${compliance_report.verdict} | Unique Issues: ${finalViolations.length}`);

    return {
      url: initialNormalized,
      timestamp,
      status: 'success',
      issuesFound: finalViolations.length,
      violations: finalViolations,
      compliance_report,
      scanType: isDeep ? 'deep' : 'basic',
      meta: {
        duration_ms: total_ms,
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        method: scrape.method,
        verification_method,
        hasCMP: meta.hasCMP,
        legal_links: meta.legal_links
      }
    };
  } catch (error: any) {
    await saveBotEvent('ERROR', `Audit Crash [${seedUrl}]: ${error.message}`);
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: error.message };
  }
}
