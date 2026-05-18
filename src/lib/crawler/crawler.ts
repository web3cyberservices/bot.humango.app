
import { scrapeUrl } from '@/lib/scraper';
import { parseHtmlContent } from '@/lib/parser';
import { isUrlAllowed } from '@/config/robots-rules';
import { saveAuditLog, saveBotEvent, saveAuditResults, normalizeUrl, saveValidationLog } from '@/lib/db';
import { verifyIntegrity } from '@/lib/validator';
import { CrawlResult, Violation } from '@/types';
import { z } from 'zod';
import { performance } from 'perf_hooks';

const urlSchema = z.string().url();

/**
 * The Loop Architecture (V23.0) - Semantic Deep Dive
 * Crawler -> Semantic Parser -> Candidate Follower -> Verifier
 */
export async function runCrawlTask(seedUrl: string, iteration: number = 1): Promise<CrawlResult> {
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

    // PHASE 1: COLLECTION (HOME PAGE)
    await saveBotEvent('SUCCESS', `Audit Loop Start: ${initialNormalized} (Iteration ${iteration})`);
    const scrape = await scrapeUrl(initialNormalized);
    if (scrape.status === 'fail') {
      return { url: initialNormalized, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: 'Failed to retrieve content' };
    }

    const isDeep = scrape.method === 'puppeteer';
    const parsed = parseHtmlContent(
      scrape.html, 
      initialNormalized, 
      scrape.rawHeaders, 
      scrape.screenshot,
      isDeep
    );

    // PHASE 2: SEMANTIC DEEP DIVE
    // If we didn't find critical docs on home page, but found potential links, follow them.
    let finalViolations: Violation[] = parsed.violations;
    const legalLinks = parsed.meta.legal_links;
    
    // We only dive deeper if we are on the first iteration and missing core docs
    if (iteration === 1) {
      const candidates = Object.entries(legalLinks).filter(([_, href]) => !!href);
      
      for (const [type, href] of candidates) {
          const deepUrl = normalizeUrl(href!, initialNormalized);
          if (deepUrl === initialNormalized) continue;

          await saveBotEvent('SUCCESS', `Semantic Discovery: Found ${type} candidate at ${deepUrl}. Diving...`);
          
          try {
            const deepScrape = await scrapeUrl(deepUrl);
            if (deepScrape.status === 'success') {
                const deepParsed = parseHtmlContent(deepScrape.html, deepUrl, deepScrape.rawHeaders, deepScrape.screenshot, deepScrape.method === 'puppeteer');
                // If deep page has actual legal content, we remove the "Missing" violation from home page
                if (deepScrape.html.length > 1000 && /pursuant to|compliance|article|gdpr|law/i.test(deepScrape.html)) {
                    finalViolations = finalViolations.filter(v => !v.issue_type.includes('MISSING') || !v.issue_type.includes(type.toUpperCase()));
                    // Merge any violations found on the actual legal page (like missing retention)
                    finalViolations = mergeFindings(finalViolations, deepParsed.violations);
                }
            }
          } catch (e) {
            console.error(`[Crawler] Deep dive failed for ${deepUrl}`, e);
          }
      }
    }

    // PHASE 3: AI VERIFICATION
    let validationResult;
    try {
      validationResult = await verifyIntegrity(scrape.html, finalViolations);
    } catch (vErr) {
      console.error('[CrawlTask] Critical error in verification phase:', vErr);
      validationResult = {
        integrity_status: 'incomplete' as const,
        validated_findings: [],
        overall_confidence: 0.1
      };
    }
    
    await saveValidationLog(initialNormalized, iteration, validationResult.integrity_status, validationResult.validated_findings, validationResult.overall_confidence);

    // PHASE 4: FINALIZATION
    const domain = new URL(initialNormalized).hostname;
    await saveAuditLog(domain, 200, null);
    
    const verifiedFindings = finalViolations.filter(v => {
        const vMatch = validationResult.validated_findings.find(vf => vf.issue_type === v.issue_type);
        return (vMatch?.confidence_score ?? 0.8) >= 0.5;
    });

    await saveAuditResults(domain, initialNormalized, verifiedFindings, iteration > 1 ? 'deep' : 'basic');
    
    const total_ms = Math.round(performance.now() - startTime);
    await saveBotEvent('SUCCESS', `Loop Finished: ${domain} | Confidence: ${validationResult.overall_confidence} | Issues: ${verifiedFindings.length}`);

    return {
      url: initialNormalized,
      timestamp,
      status: 'success',
      issuesFound: verifiedFindings.length,
      violations: verifiedFindings,
      iteration,
      compliance_report: {
        ...parsed.compliance_report,
        validation_status: validationResult.integrity_status
      },
      scanType: iteration > 1 ? 'deep' : 'basic',
      meta: {
        duration_ms: total_ms,
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        method: scrape.method,
        verification_method: iteration > 1 ? 'Dynamic Emulation' : 'Static Analysis',
        hasCMP: parsed.meta.hasCMP,
        legal_links: parsed.meta.legal_links,
        attempts: iteration,
        confidence: validationResult.overall_confidence
      }
    };
  } catch (error: any) {
    await saveBotEvent('ERROR', `Loop Crash [${seedUrl}]: ${error.message}`);
    return { url: seedUrl, timestamp, status: 'failed', issuesFound: 0, scanType: 'basic', reason: error.message };
  }
}

function mergeFindings(base: Violation[], refined: Violation[]): Violation[] {
  const merged = new Map<string, Violation>();
  base.forEach(v => merged.set(v.issue_type, v));
  refined.forEach(v => {
    const existing = merged.get(v.issue_type);
    if (!existing || v.confidence_score > (existing.confidence_score || 0)) {
      merged.set(v.issue_type, v);
    }
  });
  return Array.from(merged.values());
}
