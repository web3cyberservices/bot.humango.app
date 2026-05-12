
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
 * The Loop Architecture (V22.0)
 * Crawler -> Verifier -> Re-Tasker -> Finalizer
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

    // PHASE 1: COLLECTION
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

    // PHASE 2: VERIFICATION
    const validationResult = await verifyIntegrity(scrape.html, parsed.violations);
    
    // Log the validation attempt
    await saveValidationLog(
      initialNormalized, 
      iteration, 
      validationResult.integrity_status, 
      validationResult.validated_findings,
      validationResult.overall_confidence
    );

    // PHASE 3: RE-TASKING / REFINEMENT
    let finalViolations: Violation[] = parsed.violations.map(v => {
      const vMatch = validationResult.validated_findings.find(vf => vf.issue_type === v.issue_type);
      return {
        ...v,
        confidence_score: vMatch?.confidence_score ?? 0,
        evidence_quote: vMatch?.evidence_quote,
        business_impact: vMatch?.business_impact || v.business_impact || 'Regulatory non-compliance escalates financial and operational risks.',
        verification_status: vMatch?.verification_status || 'pending',
        is_hallucination: vMatch?.is_hallucination ?? false
      };
    }).filter(v => !v.is_hallucination && v.confidence_score > 0);

    // Check if we need to deep-dive for missing facts
    const needsRefinement = iteration < 2 && (
      validationResult.overall_confidence < 0.9 || 
      validationResult.integrity_status === 'incomplete'
    );

    if (needsRefinement) {
      const legalLinks = parsed.meta.legal_links;
      const targetUrl = legalLinks.impressum || legalLinks.privacy;
      
      if (targetUrl) {
        const deepUrl = normalizeUrl(targetUrl, initialNormalized);
        await saveBotEvent('SUCCESS', `Confidence Low [${validationResult.overall_confidence}]. Triggering Targeted Deep Dive: ${deepUrl}`);
        
        const deepResult = await runCrawlTask(deepUrl, iteration + 1);
        
        if (deepResult.status === 'success' && deepResult.violations) {
          finalViolations = mergeFindings(finalViolations, deepResult.violations);
        }
      }
    }

    // PHASE 4: FINALIZATION
    const domain = new URL(initialNormalized).hostname;
    await saveAuditLog(domain, 200, null);
    
    const verifiedFindings = finalViolations.filter(v => v.confidence_score >= 0.5);
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
    if (!existing || v.confidence_score > existing.confidence_score) {
      merged.set(v.issue_type, v);
    }
  });
  
  return Array.from(merged.values());
}
