
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in environment variables!');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function sanitize(text: string | null | undefined, fallback: string = ''): string {
  if (!text) return fallback;
  return String(text).trim().replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
}

export function normalizeUrl(url: string, base?: string): string {
  try {
    let target = url.trim();
    if (base) {
      const baseUrl = base.startsWith('http') ? base : `https://${base}`;
      return new URL(target, baseUrl).href.toLowerCase();
    }
    if (!target.startsWith('http')) target = `https://${target}`;
    const u = new URL(target);
    u.hash = ''; u.search = '';
    return u.href.toLowerCase();
  } catch (e) {
    return 'invalid-target';
  }
}

export async function queueTask(url: string, email: string, priority: number = 0) {
  const cleanUrl = normalizeUrl(url);
  await pool.query(
    `INSERT INTO public.scan_queue (url, status, priority, user_email, created_at) VALUES ($1, 'pending', $2, $3, NOW()) ON CONFLICT (url) DO UPDATE SET status = 'pending', priority = $2, user_email = $3;`,
    [cleanUrl, priority, email]
  );
  return cleanUrl;
}

export async function getTaskStatus(url: string) {
  const res = await pool.query('SELECT status FROM public.scan_queue WHERE url = $1', [normalizeUrl(url)]);
  return res.rows[0] || null;
}

export async function saveAuditResults(domain: string, url: string, violations: any[], scanType: string = 'basic') {
  let filteredViolations = violations;
  if (violations.some(v => v.issue_type === 'MISSING CORE FRAMEWORK')) {
    filteredViolations = violations.filter(v => v.issue_type === 'MISSING CORE FRAMEWORK');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const v of filteredViolations) {
      await client.query(`
        INSERT INTO site_violations (
          domain, url, page_url, category, issue_type, severity, 
          evidence_html, description, law_name, recommendation, 
          scan_type, report_type, created_at, business_impact, explanation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)`,
        [
          sanitize(domain), sanitize(url), sanitize(url), v.category || 'Privacy', 
          v.issue_type, v.severity || 'critical', sanitize(url), 
          sanitize(v.description || v.summary), sanitize(v.law_name), 
          sanitize(v.recommendation || v.action), scanType, 
          v.report_type || 'SaaS', sanitize(v.business_impact), sanitize(v.explanation || v.description)
        ]
      );
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (e) {
    await client.query('ROLLBACK');
    return { success: false };
  } finally {
    client.release();
  }
}

export async function saveBotEvent(type: string, message: string) {
  await pool.query('INSERT INTO bot_events (type, message, timestamp) VALUES ($1, $2, NOW())', [type, sanitize(message)]);
}

export async function getBotStatus(): Promise<boolean> {
  const res = await pool.query('SELECT is_active FROM bot_settings WHERE id = 1');
  return res.rows[0]?.is_active ?? true;
}

export async function setBotStatus(isActive: boolean) {
  try {
    await pool.query('UPDATE public.bot_settings SET is_active = $1, updated_at = NOW() WHERE id = 1', [isActive]);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getNextQueueItem() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query("SELECT id, url, user_email FROM scan_queue WHERE status = 'pending' ORDER BY priority DESC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED");
    const task = res.rows[0];
    if (task) await client.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
    await client.query('COMMIT');
    return task || null;
  } catch (e) {
    await client.query('ROLLBACK');
    return null;
  } finally {
    client.release();
  }
}

export async function updateQueueStatus(id: number, status: string) {
  await pool.query('UPDATE scan_queue SET status = $1 WHERE id = $2', [status, id]);
}

export async function getBotEvents(limit: number = 50) {
  const res = await pool.query('SELECT id, type, message, timestamp FROM public.bot_events ORDER BY timestamp DESC LIMIT $1', [limit]);
  return res.rows;
}

export async function getViolations(limit: number = 100) {
  const res = await pool.query(`
    SELECT 
      id, domain, url, page_url, category, issue_type as type, severity as level, 
      evidence_html, evidence_quote, confidence_score, verification_status, 
      snippet, description, explanation as summary, law_name, fine_amount, 
      recommendation, scan_type, report_type, verification_method, 
      business_impact, created_at as date
    FROM public.site_violations 
    ORDER BY created_at DESC LIMIT $1
  `, [limit]);
  return res.rows;
}

export async function saveValidationLog(url: string, attempt: number, status: string, findings: any[], confidence: number) {
  const domain = new URL(url).hostname;
  await pool.query(
    'INSERT INTO public.validation_logs (domain, url, attempt, status, findings, confidence_score, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
    [domain, url, attempt, status, JSON.stringify(findings), confidence]
  );
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  await pool.query(
    'INSERT INTO public.audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())',
    [domain, statusCode, errorMessage]
  );
}

export async function testConnection() {
  const client = await pool.connect();
  try { await client.query('SELECT 1'); return true; } finally { client.release(); }
}
