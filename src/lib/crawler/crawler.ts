
import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed } from '@/config/robots-rules';
import { saveAuditLog, saveBotEvent, saveAuditResults, normalizeUrl, saveValidationLog } from '@/lib/db';
import { verifyIntegrity } from '@/lib/validator';
import { CrawlResult, Violation, VerificationMethod } from '@/types';
import { z } from 'zod';
import { performance } from 'perf_hooks';

const urlSchema = z.string().url();

export async function runCrawlTask(seedUrl: string, attempt: number = 1): Promise<CrawlResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    const validation = urlSchema.safeParse(seedUrl);
    if (!validation.success) {
      return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: 'Invalid URL format' };
    }

    const initialNormalized = normalizeUrl(seedUrl) || seedUrl;

    const robotsCheck = await isUrlAllowed(initialNormalized);
    if (!robotsCheck.allowed) {
      return { url: initialNormalized, timestamp, status: 'blocked', issuesFound: 0, scanType: 'basic', reason: robotsCheck.reason };
    }

    // Step 1: Initial Scrape
    const scrape = await scrapeUrl(initialNormalized);
    if (scrape.status === 'fail') {
      return { url: initialNormalized, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: 'Failed to retrieve content' };
    }

    // Step 2: Diagnostic Parsing
    const isDeep = scrape.method === 'puppeteer';
    const { violations: initialViolations, meta, compliance_report: initialReport } = parseHtmlContent(
      scrape.html, 
      initialNormalized, 
      scrape.rawHeaders, 
      scrape.screenshot,
      isDeep
    );

    // Step 3: Integrity Validation Layer
    await saveBotEvent('SUCCESS', `Validating integrity for ${initialNormalized} (Attempt ${attempt})`);
    const validationResult = await verifyIntegrity(scrape.html, initialViolations);
    
    // Log the validation attempt
    await saveValidationLog(initialNormalized, attempt, validationResult.integrity_status, validationResult.validated_findings);

    // Step 4: Re-Crawl Trigger (Recursive Logic)
    let finalViolations = initialViolations.map(v => {
      const vMatch = validationResult.validated_findings.find(vf => vf.issue_type === v.issue_type);
      return {
        ...v,
        confidence_score: vMatch?.confidence_score ?? 0,
        evidence_quote: vMatch?.evidence_quote,
        is_hallucination: vMatch?.is_hallucination ?? false
      };
    }).filter(v => !v.is_hallucination && v.confidence_score > 0);

    // If critical data is missing or confidence is low, and we haven't tried a deep scan yet
    const needsDeepScan = (validationResult.integrity_status !== 'verified' || finalViolations.some(v => v.confidence_score < 0.8)) && attempt < 2 && !isDeep;

    if (needsDeepScan && meta.legal_links.impressum) {
      const contactUrl = normalizeUrl(meta.legal_links.impressum, initialNormalized);
      await saveBotEvent('SUCCESS', `Confidence low. Triggering recursive Deep Scan on: ${contactUrl}`);
      const deepResult = await runCrawlTask(contactUrl, attempt + 1);
      
      // Merge results
      if (deepResult.status === 'success' && deepResult.violations) {
        finalViolations = [...finalViolations, ...deepResult.violations];
      }
    }

    const domain = new URL(initialNormalized).hostname;
    await saveAuditLog(domain, 200, null);
    await saveAuditResults(domain, initialNormalized, finalViolations, isDeep ? 'deep' : 'basic');
    
    const total_ms = Math.round(performance.now() - startTime);
    await saveBotEvent('SUCCESS', `Audit finished: ${domain} | Confidence: ${validationResult.integrity_status} | Issues: ${finalViolations.length}`);

    return {
      url: initialNormalized,
      timestamp,
      status: 'success',
      issuesFound: finalViolations.length,
      violations: finalViolations,
      compliance_report: {
        ...initialReport,
        validation_status: validationResult.integrity_status
      },
      scanType: isDeep ? 'deep' : 'basic',
      meta: {
        duration_ms: total_ms,
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        method: scrape.method,
        verification_method: isDeep ? 'Dynamic Emulation' : 'Static Analysis',
        hasCMP: meta.hasCMP,
        legal_links: meta.legal_links,
        attempts: attempt
      }
    };
  } catch (error: any) {
    await saveBotEvent('ERROR', `Audit Crash [${seedUrl}]: ${error.message}`);
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: error.message };
  }
}
