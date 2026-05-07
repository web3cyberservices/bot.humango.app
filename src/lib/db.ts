
import { Pool } from 'pg';
import DOMPurify from 'isomorphic-dompurify';
import { Violation, ScanType } from '@/types';

const connectionString = process.env.DATABASE_URL;

if (connectionString) {
  console.log('[DB] Attempting to connect to:', connectionString.replace(/:[^:]+@/, ':****@'));
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB Pool Error] Unexpected error:', err);
});

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text);
}

/**
 * Сохранение расширенных результатов аудита.
 */
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
  const query = 'INSERT INTO public.bot_events (type, message, timestamp) VALUES ($1, $2, NOW())';
  try {
    await pool.query(query, [type, sanitize(message)]);
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

export async function cleanupOldLogs(days = 30) {
  try {
    await pool.query("DELETE FROM public.audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval", [days]);
    await pool.query("DELETE FROM public.audit_results WHERE created_at < NOW() - ($1 || ' days')::interval", [days]);
    await pool.query("DELETE FROM public.bot_events WHERE timestamp < NOW() - ($1 || ' days')::interval", [days]);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  const query = 'INSERT INTO public.audit_logs (domain, status_code, error_message, created_at) VALUES ($1, $2, $3, NOW())';
  try {
    await pool.query(query, [sanitize(domain), statusCode, sanitize(errorMessage)]);
    return { success: true };
  } catch (error) {
    return { success: false };
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

/**
 * Атомарное получение и резервирование задачи из очереди.
 */
export async function getNextQueueItem() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Строгий SQL запрос с указанием схемы и сортировкой
    const query = "SELECT id, url FROM public.scan_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED";
    const result = await client.query(query);
    
    console.log('[DB] SQL Query executed. Result:', result.rows);
    if (result.rows.length === 0) {
      console.log('[DB] No tasks found with status pending!');
    }
    
    const task = result.rows[0];

    if (task) {
      // Сразу обновляем статус на processing
      await client.query("UPDATE public.scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
    }

    await client.query('COMMIT');
    return task || null;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Error] Failed to fetch/claim next queue item:', error);
    return null;
  } finally {
    client.release();
  }
}

export async function updateQueueStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed') {
  try {
    await pool.query('UPDATE public.scan_queue SET status = $1 WHERE id = $2', [status, id]);
  } catch (error) {
    console.error('[DB Error] Failed to update status:', error);
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
    console.error('[DB Error] Failed to add to queue:', error);
  }
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
