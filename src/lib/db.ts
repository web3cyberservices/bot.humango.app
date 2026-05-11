
import 'dotenv/config';
import { Pool } from 'pg';
import DOMPurify from 'isomorphic-dompurify';
import { Violation, ScanType } from '@/types';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in environment variables!');
}

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text);
}

/**
 * Robust URL Normalizer (Hardened for Deduplication)
 * Standardizes URLs to prevent duplicates like site.com/ and site.com.
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    let pathname = u.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;
    return u.href.toLowerCase();
  } catch (e) {
    return url.toLowerCase().replace(/\/$/, "").split('?')[0];
  }
}

export async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    return true;
  } catch (err: any) {
    console.error('[DB] Connection test FAILED:', err.message);
    throw err;
  }
}

export async function saveAuditResults(domain: string, url: string, violations: Violation[], scanType: ScanType = 'basic') {
  if (!violations || violations.length === 0) {
    return { success: true };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Normalizing audit base URL
    const cleanUrl = normalizeUrl(url);

    // Deduplication by issue_type and page_url
    const uniqueViolations = new Map();
    violations.forEach(v => {
      const affectedUrl = normalizeUrl(v.evidence_html || url);
      const key = `${v.issue_type}_${affectedUrl}`;
      if (!uniqueViolations.has(key)) {
        uniqueViolations.set(key, { ...v, evidence_html: affectedUrl });
      }
    });

    const query = `
      INSERT INTO site_violations (
        domain, url, page_url, category, issue_type, severity, 
        evidence_html, snippet, description, explanation, law_name, recommendation, 
        scan_type, report_type, created_at, fine_amount, verification_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, $16)
    `;

    for (const v of uniqueViolations.values()) {
      await client.query(query, [
        sanitize(domain),
        sanitize(cleanUrl),
        sanitize(v.evidence_html),
        v.category,
        v.issue_type,
        v.severity,
        sanitize(v.evidence_html),
        sanitize(v.snippet || ''),
        sanitize(v.description), 
        sanitize(v.explanation), 
        sanitize(v.law_name),
        sanitize(v.recommendation),
        scanType,
        v.report_type,
        v.potential_fine || v.fine_amount,
        v.verification_method || (scanType === 'deep' ? 'Dynamic Emulation' : 'Static Analysis')
      ]);
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[DB SAVE ERROR]', error.stack || error.message);
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

export async function getBotEvents(limit = 50) {
  try {
    const res = await pool.query('SELECT id, type, message, timestamp FROM bot_events ORDER BY timestamp DESC LIMIT $1', [limit]);
    return res.rows;
  } catch (error) {
    return [];
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

export async function getQueueSize(): Promise<number> {
  try {
    const res = await pool.query("SELECT COUNT(*) as count FROM scan_queue WHERE status = 'pending'");
    return parseInt(res.rows[0]?.count || '0', 10);
  } catch (error) {
    return 0;
  }
}

export async function addToQueue(url: string, depth: number = 0, priority: number = 0) {
  try {
    const normalized = normalizeUrl(url);
    await pool.query(
      "INSERT INTO scan_queue (url, status, depth, priority) VALUES ($1, 'pending', $2, $3) ON CONFLICT (url) DO NOTHING", 
      [normalized, depth, priority]
    );
  } catch (error) {}
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  try {
    await pool.query('INSERT INTO audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())', [sanitize(domain), statusCode, sanitize(errorMessage)]);
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
        fine_amount, law_name, page_url as url, evidence_html, report_type, snippet, verification_method
      FROM site_violations ORDER BY created_at DESC LIMIT $1
    `, [limit]);
    return res.rows || [];
  } catch (error) {
    return [];
  }
}
