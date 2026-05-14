
import { Pool } from 'pg';
import DOMPurify from 'isomorphic-dompurify';
import { Violation, ScanType } from '@/types';

/**
 * @fileOverview Automated Legal Fixer V32.1 - ESM Compatibility Patch.
 * 
 * - SECURITY: Strict hostname validation, blocking IPs and non-standard ports.
 * - TRUTH-MAPPING: Programmatic prevention of "Missing vs Incomplete" contradictions.
 * - SANITIZATION: ESM-safe DOMPurify integration.
 */

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in environment variables!');
}

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function sanitize(text: string | null | undefined, fallback: string = 'Information verified via bot.humango.app.'): string {
  if (text === null || text === undefined || text === 'null' || String(text).trim() === '') return fallback;
  // Use a safe version of DOMPurify that works in both Node (ESM) and Browser
  return DOMPurify.sanitize(String(text).trim());
}

export function normalizeUrl(url: string, base?: string): string {
  try {
    const u = base ? new URL(url, base) : new URL(url);
    
    // Security Gate: Port restriction (80/443 only)
    if (u.port && !['80', '443'].includes(u.port)) {
      throw new Error('Forbidden port');
    }

    // Security Gate: Hostname validation (No raw IPs)
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(u.hostname)) {
      throw new Error('IP-based targets are blocked for security compliance');
    }

    u.hash = '';
    u.search = '';
    let pathname = u.pathname.toLowerCase();
    if (pathname === '') pathname = '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    u.pathname = pathname;
    return u.href.toLowerCase();
  } catch (e) {
    return 'invalid-target';
  }
}

export async function saveAuditResults(domain: string, url: string, violations: Violation[], scanType: ScanType = 'basic') {
  if (!violations || violations.length === 0) return { success: true };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // V32.0: TRUTH-MAPPING LOGIC
    // Check if any finding verified a document existence
    const documentDetectedOnSite = violations.some(v => 
      v.verification_status === 'verified' && 
      !v.issue_type.toLowerCase().includes('missing') &&
      v.confidence_score > 0.6
    );

    const query = `
      INSERT INTO site_violations (
        domain, url, page_url, category, issue_type, severity, 
        evidence_html, evidence_quote, confidence_score, verification_status,
        description, explanation, law_name, recommendation, scan_type, report_type, 
        created_at, fine_amount, verification_method, business_impact
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17, $18, $19)
    `;

    for (const v of violations) {
      let finalIssueType = v.issue_type;
      let finalDescription = v.description;
      let finalSeverity = v.severity;
      
      const isMissingStatus = finalIssueType.toLowerCase().includes('missing');

      // V32.0 Logic Bridge: Programmatic Truth Mapping
      if (isMissingStatus && documentDetectedOnSite) {
        finalIssueType = "CRITICAL INCOMPLETENESS";
        finalDescription = `The document was discovered via targeted deep-dive but is legally invalid due to lack of accessibility in the primary footer (Violation of Art. 12 GDPR).`;
        finalSeverity = 'high';
      }

      const standardLiability = "Administrative penalties up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). High risk of immediate ad account suspension (Meta/Google).";
      const standardImpact = "Business Risk: Immediate loss of marketing ROI as Google/Meta require valid compliance signals to execute advertising campaigns.";
      
      let liability = v.potential_fine;
      if (!liability || liability === 'null' || String(liability).toLowerCase() === 'null') {
        liability = standardLiability;
      }

      let impact = sanitize(v.business_impact, standardImpact);
      if (impact === 'null' || impact.length < 5) impact = standardImpact;

      let remediation = v.recommendation || '';
      if (remediation && !remediation.startsWith('ACTION:')) {
        remediation = `ACTION: INSERT THIS TEXT -> ${remediation}`;
      }

      await client.query(query, [
        sanitize(domain),
        sanitize(normalizeUrl(url)),
        sanitize(url), 
        v.category,
        sanitize(finalIssueType),
        finalSeverity,
        sanitize(v.evidence_html || url),
        sanitize(v.evidence_quote, "Verified via bot.humango.app."),
        v.confidence_score || 0.8,
        v.verification_status || 'verified',
        sanitize(finalDescription), 
        sanitize(v.explanation || finalDescription), 
        sanitize(v.law_name, "GDPR Article 13"),
        sanitize(remediation),
        scanType,
        v.report_type,
        sanitize(liability),
        v.verification_method || (scanType === 'deep' ? 'Dynamic Emulation' : 'Static Analysis'),
        sanitize(impact)
      ]);
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[DB V32.0 CRITICAL SAVE ERROR]', error.stack);
    return { success: false, error };
  } finally {
    client.release();
  }
}

export async function saveBotEvent(type: 'START' | 'STOP' | 'ERROR' | 'SUCCESS', message: string) {
  try {
    await pool.query('INSERT INTO bot_events (type, message, timestamp) VALUES ($1, $2, NOW())', [type, sanitize(message)]);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getBotStatus(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT is_active FROM bot_settings WHERE id = 1');
    return res.rows[0]?.is_active ?? true;
  } catch (error) {
    return true;
  }
}

export async function setBotStatus(isActive: boolean) {
  try {
    await pool.query('UPDATE bot_settings SET is_active = $1, updated_at = NOW() WHERE id = 1', [isActive]);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getNextQueueItem() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = "SELECT id, url, depth FROM scan_queue WHERE status = 'pending' ORDER BY priority DESC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED";
    const result = await client.query(query);
    const task = result.rows[0];
    if (task) {
      await client.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
    }
    await client.query('COMMIT');
    return task || null;
  } catch (error: any) {
    await client.query('ROLLBACK');
    return null;
  } finally {
    client.release();
  }
}

export async function updateQueueStatus(id: number, status: 'completed' | 'failed') {
  try {
    await pool.query('UPDATE scan_queue SET status = $1 WHERE id = $2', [status, id]);
  } catch (error) {}
}

export async function getStats() {
  try {
    const pagesRes = await pool.query('SELECT COUNT(*) as count FROM audit_logs');
    const issuesRes = await pool.query('SELECT COUNT(*) as total FROM site_violations');
    const recentIssues = await getViolations(10);
    return {
      pagesScanned: Number(pagesRes.rows[0]?.count) || 0,
      issuesFound: Number(issuesRes.rows[0]?.total) || 0,
      recentIssues: recentIssues
    };
  } catch (error) {
    return { pagesScanned: 0, issuesFound: 0, recentIssues: [] };
  }
}

export async function getViolations(limit = 100) {
  try {
    const res = await pool.query(`
      SELECT 
        id, domain, issue_type as type, severity as level, created_at as date, 
        description as summary, explanation as description,
        fine_amount, law_name, page_url as url, evidence_html, evidence_quote, 
        confidence_score, verification_status, report_type, verification_method, business_impact, recommendation
      FROM site_violations ORDER BY created_at DESC LIMIT $1
    `, [limit]);
    return res.rows || [];
  } catch (error) {
    return [];
  }
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  try {
    await pool.query('INSERT INTO audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())', [sanitize(domain), statusCode, sanitize(errorMessage)]);
  } catch (error) {}
}

export async function saveValidationLog(url: string, iteration: number, status: string, findings: any[], confidence: number) {
  try {
    const domain = new URL(url).hostname;
    await pool.query(
      'INSERT INTO validation_logs (domain, url, attempt, status, findings, confidence_score, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [sanitize(domain), sanitize(url), iteration, status, JSON.stringify(findings), confidence]
    );
  } catch (e) {}
}

export async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return true;
  } catch (error: any) {
    console.error('[DB Handshake Failure]', error.message);
    throw error;
  } finally {
    if (client) client.release();
  }
}
