
import 'dotenv/config';
import { Pool } from 'pg';
import DOMPurify from 'isomorphic-dompurify';
import { Violation, ScanType } from '@/types';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in environment variables!');
}

const connectionString = process.env.DATABASE_URL;

console.log('[DB] Initializing Pool for:', connectionString.replace(/:[^:]+@/, ':****@'));

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

pool.on('error', (err) => {
  console.error('[DB Pool ERROR]', err.message);
});

pool.on('connect', () => {
  // Silent heartbeat check
});

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text);
}

export async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log('[DB] Connection test successful:', res.rows[0].now);
    return true;
  } catch (err: any) {
    console.error('[DB] Connection test FAILED:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function saveAuditResults(domain: string, url: string, violations: Violation[], scanType: ScanType = 'basic') {
  if (violations.length === 0) return { success: true };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const query = `
      INSERT INTO public.audit_results (
        domain, url, category, issue_type, severity, evidence_html, 
        description, recommendation, scan_type, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `;

    for (const v of violations) {
      await client.query(query, [
        sanitize(domain),
        sanitize(url),
        v.category,
        v.issue_type,
        v.severity,
        sanitize(v.evidence_html),
        sanitize(v.description),
        sanitize(v.recommendation),
        scanType,
        JSON.stringify(v.metadata || {})
      ]);
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Error] Failed to save audit results:', error);
    return { success: false, error };
  } finally {
    client.release();
  }
}

export async function saveBotEvent(type: 'START' | 'STOP' | 'ERROR' | 'SUCCESS', message: string) {
  try {
    await pool.query('INSERT INTO public.bot_events (type, message, timestamp) VALUES ($1, $2, NOW())', [type, sanitize(message)]);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getBotEvents(limit = 50) {
  try {
    const res = await pool.query('SELECT * FROM public.bot_events ORDER BY timestamp DESC LIMIT $1', [limit]);
    return res.rows.map(event => ({ ...event, message: sanitize(event.message) }));
  } catch (error) {
    return [];
  }
}

export async function getBotStatus(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT is_active FROM public.bot_settings WHERE id = 1');
    return res.rows.length > 0 ? res.rows[0].is_active : true;
  } catch (error) {
    return true;
  }
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
    
    // Explicitly target pending tasks with row-level locking
    const query = "SELECT id, url FROM public.scan_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED";
    const result = await client.query(query);
    
    const task = result.rows[0];

    if (task) {
      await client.query("UPDATE public.scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
      console.log(`[DB] Task claimed: ${task.url} (ID: ${task.id})`);
    }

    await client.query('COMMIT');
    return task || null;
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[DB Error] Transaction failed in getNextQueueItem:', error.message);
    return null;
  } finally {
    client.release(); // Essential: release back to pool
  }
}

export async function updateQueueStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed') {
  try {
    await pool.query('UPDATE public.scan_queue SET status = $1 WHERE id = $2', [status, id]);
  } catch (error) {
    console.error('[DB Error] Failed to update queue status:', error);
  }
}

export async function getQueueSize(): Promise<number> {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM public.scan_queue WHERE status = 'pending'");
    return parseInt(res.rows[0].count);
  } catch (error) {
    return 0;
  }
}

export async function addToQueue(url: string) {
  try {
    await pool.query("INSERT INTO public.scan_queue (url, status) VALUES ($1, 'pending') ON CONFLICT (url) DO NOTHING", [url]);
  } catch (error) {
    // Ignore duplicates
  }
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  try {
    await pool.query('INSERT INTO public.audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())', [sanitize(domain), statusCode, sanitize(errorMessage)]);
  } catch (error) {}
}

export async function getStats() {
  try {
    const pagesRes = await pool.query('SELECT COUNT(*) as count FROM public.audit_logs');
    const issuesRes = await pool.query('SELECT COUNT(*) as count FROM public.audit_results');
    const recentIssues = await pool.query('SELECT * FROM public.audit_results ORDER BY created_at DESC LIMIT 50');
    
    return {
      pagesScanned: parseInt(pagesRes.rows[0].count),
      issuesFound: parseInt(issuesRes.rows[0].count),
      recentIssues: recentIssues.rows
    };
  } catch (error) {
    return { pagesScanned: 0, issuesFound: 0, recentIssues: [] };
  }
}

export async function getViolations() {
  try {
    const res = await pool.query('SELECT * FROM public.audit_results ORDER BY created_at DESC');
    return res.rows;
  } catch (error) {
    return [];
  }
}
