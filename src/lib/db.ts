
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
    `INSERT INTO public.scan_queue (url, status, priority, user_email, created_at, crm_status) 
     VALUES ($1, 'pending', $2, $3, NOW(), 'free') 
     ON CONFLICT (url) DO UPDATE SET status = 'pending', priority = $2, user_email = $3, crm_status = 'free';`,
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
      q.id, q.url as domain, q.url, q.status, q.crm_status,
      q.assigned_to as "assignedTo", q.manager_name as "managerName", q.assigned_at as "assignedAt",
      q.violations_count as violation_count
    FROM public.scan_queue q
    ORDER BY q.violations_count DESC, q.created_at DESC LIMIT $1
  `, [limit]);
  
  return res.rows.map(row => ({
    id: row.id,
    domain: row.domain.replace(/^https?:\/\//, ''),
    type: 'Audit',
    level: row.violation_count > 0 ? 'critical' : 'low',
    date: row.assignedAt || row.created_at || new Date(),
    summary: `Found ${row.violation_count} violations`,
    description: `Automated scan results for ${row.domain}`,
    report_type: 'SaaS',
    assignedTo: row.assignedTo,
    managerName: row.managerName,
    assignedAt: row.assignedAt,
    status: row.status,
    crm_status: row.crm_status
  }));
}

export async function updateTaskStatus(taskId: number, status: string) {
  await pool.query(
    'UPDATE public.scan_queue SET status = $1 WHERE id = $2',
    [status, taskId]
  );
  return { success: true };
}

export async function getManagersStats() {
  const res = await pool.query(`
    SELECT 
      manager_name as name, 
      count(*) as task_count,
      count(*) FILTER (WHERE status = 'done' OR status = 'completed') as completed_count
    FROM public.scan_queue 
    WHERE assigned_to IS NOT NULL 
    GROUP BY manager_name
    ORDER BY task_count DESC
  `);
  return res.rows;
}

export async function testConnection() {
  const client = await pool.connect();
  try { await client.query('SELECT 1'); return true; } finally { client.release(); }
}
