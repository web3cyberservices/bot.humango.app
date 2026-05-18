
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
    return url.startsWith('http') ? url : `https://${url}`;
  }
}

export async function queueTask(url: string, email: string, priority: number = 0) {
  const cleanUrl = normalizeUrl(url);
  await pool.query(
    `INSERT INTO public.scan_queue (url, status, priority, user_email, created_at) 
     VALUES ($1, 'pending', $2, $3, NOW()) 
     ON CONFLICT (url) DO UPDATE SET status = 'pending', priority = $2, user_email = $3;`,
    [cleanUrl, priority, email]
  );
  return cleanUrl;
}

export async function getTaskStatus(url: string) {
  const cleanUrl = normalizeUrl(url);
  const res = await pool.query('SELECT status FROM public.scan_queue WHERE url = $1', [cleanUrl]);
  return res.rows[0] || null;
}

export async function saveBotEvent(type: string, message: string) {
  await pool.query('INSERT INTO bot_events (type, message, timestamp) VALUES ($1, $2, NOW())', [type, sanitize(message)]);
}

export async function getBotStatus(): Promise<boolean> {
  const res = await pool.query('SELECT is_active FROM bot_settings WHERE id = 1');
  return res.rows[0]?.is_active ?? true;
}

export async function setBotStatus(isActive: boolean) {
  await pool.query('UPDATE public.bot_settings SET is_active = $1, updated_at = NOW() WHERE id = 1', [isActive]);
  return { success: true };
}

export async function getBotEvents(limit: number = 50) {
  const res = await pool.query('SELECT id, type, message, timestamp FROM public.bot_events ORDER BY timestamp DESC LIMIT $1', [limit]);
  return res.rows;
}

export async function getViolations(limit: number = 100) {
  const res = await pool.query(`
    SELECT 
      id, domain, url, page_url, category, issue_type as type, severity as level, 
      evidence_html, description, explanation as summary, law_name, 
      recommendation, scan_type, report_type, business_impact, created_at as date,
      assigned_to as "assignedTo", manager_name as "managerName", assigned_at as "assignedAt"
    FROM public.site_violations 
    ORDER BY created_at DESC LIMIT $1
  `, [limit]);
  return res.rows;
}

export async function saveViolation(data: any) {
  const { domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type } = data;
  await pool.query(
    `INSERT INTO public.site_violations (
      domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
    [domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type || 'SaaS']
  );
}

export async function testConnection() {
  const client = await pool.connect();
  try { await client.query('SELECT 1'); return true; } finally { client.release(); }
}
