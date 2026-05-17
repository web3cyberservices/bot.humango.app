
import { Pool } from 'pg';
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
  connectionTimeoutMillis: 10000,
});

function sanitize(text: string | null | undefined, fallback: string = 'Information verified via bot.humango.app.'): string {
  if (text === null || text === undefined || text === 'null' || String(text).trim() === '') return fallback;
  const content = String(text).trim();
  try {
    return content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
  } catch (e) {
    return content;
  }
}

export function normalizeUrl(url: string, base?: string): string {
  try {
    const u = base ? new URL(url, base) : new URL(url);
    if (u.port && !['80', '443'].includes(u.port)) throw new Error('Forbidden port');
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(u.hostname)) throw new Error('IP-based targets blocked');
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

export async function queueTask(url: string, email: string, priority: number = 0) {
  const cleanUrl = normalizeUrl(url);
  if (cleanUrl === 'invalid-target') throw new Error('Invalid URL');
  
  await pool.query(
    `INSERT INTO public.scan_queue (url, status, priority, user_email, created_at) 
     VALUES ($1, 'pending', $2, $3, NOW()) 
     ON CONFLICT (url) 
     DO UPDATE SET status = 'pending', priority = $2, user_email = $3, created_at = NOW();`,
    [cleanUrl, priority, email]
  );
  return cleanUrl;
}

export async function getTaskStatus(url: string) {
  const cleanUrl = normalizeUrl(url);
  const res = await pool.query('SELECT status, user_email FROM public.scan_queue WHERE url = $1', [cleanUrl]);
  return res.rows[0] || null;
}

export async function saveAuditResults(domain: string, url: string, violations: Violation[], scanType: ScanType = 'basic') {
  if (!violations || violations.length === 0) return { success: true };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
      await client.query(query, [
        sanitize(domain), sanitize(normalizeUrl(url)), sanitize(url), v.category,
        sanitize(v.issue_type), v.severity, sanitize(v.evidence_html || url),
        sanitize(v.evidence_quote, "Verified via bot.humango.app."), v.confidence_score || 0.8,
        v.verification_status || 'verified', sanitize(v.description), sanitize(v.explanation || v.description),
        sanitize(v.law_name, "GDPR Article 13"), sanitize(v.recommendation), scanType, v.report_type,
        sanitize(v.potential_fine || "Fines up to €20M"), 
        v.verification_method || (scanType === 'deep' ? 'Dynamic Emulation' : 'Static Analysis'),
        sanitize(v.business_impact, "Business Risk: Loss of advertising access.")
      ]);
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (error: any) {
    await client.query('ROLLBACK');
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

export async function getNextQueueItem() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = "SELECT id, url, depth, user_email FROM scan_queue WHERE status = 'pending' ORDER BY priority DESC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED";
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
  await pool.query('UPDATE scan_queue SET status = $1 WHERE id = $2', [status, id]);
}

export async function getStats() {
  const pagesRes = await pool.query('SELECT COUNT(*) as count FROM audit_logs');
  const issuesRes = await pool.query('SELECT COUNT(*) as total FROM site_violations');
  const recentIssues = await getViolations(10);
  return {
    pagesScanned: Number(pagesRes.rows[0]?.count) || 0,
    issuesFound: Number(issuesRes.rows[0]?.total) || 0,
    recentIssues: recentIssues
  };
}

export async function getViolations(limit = 100) {
  const res = await pool.query(`
    SELECT 
      id, domain, issue_type as type, severity as level, created_at as date, 
      description as summary, explanation as description,
      fine_amount, law_name, page_url as url, evidence_html, evidence_quote, 
      confidence_score, verification_status, report_type, verification_method, business_impact, recommendation
    FROM site_violations ORDER BY created_at DESC LIMIT $1
  `, [limit]);
  return res.rows || [];
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  await pool.query('INSERT INTO audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())', [sanitize(domain), statusCode, sanitize(errorMessage)]);
}

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}
