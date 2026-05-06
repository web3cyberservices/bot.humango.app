import { Pool } from 'pg';
import DOMPurify from 'isomorphic-dompurify';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text);
}

export async function saveBotEvent(type: 'START' | 'STOP' | 'ERROR' | 'SUCCESS', message: string) {
  const query = `
    INSERT INTO bot_events (type, message, timestamp)
    VALUES ($1, $2, NOW())
  `;
  const values = [type, sanitize(message)];
  try {
    const client = await pool.connect();
    try {
      await client.query(query, values);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to save bot event:', error);
    return { success: false, error };
  }
}

export async function getBotEvents(limit = 50) {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM bot_events ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows.map(event => ({
        ...event,
        message: sanitize(event.message)
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to fetch bot events:', error);
    return [];
  }
}

export async function cleanupOldLogs(days = 30) {
  try {
    const client = await pool.connect();
    try {
      console.log(`[DB] Cleaning up logs older than ${days} days...`);
      await client.query("DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '$1 days'", [days]);
      await client.query("DELETE FROM bot_events WHERE timestamp < NOW() - INTERVAL '$1 days'", [days]);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Cleanup failed:', error);
    return { success: false, error };
  }
}

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  const query = `
    INSERT INTO audit_logs (domain, status_code, error_message, created_at)
    VALUES ($1, $2, $3, NOW())
  `;
  const values = [sanitize(domain), statusCode, sanitize(errorMessage)];
  try {
    const client = await pool.connect();
    try {
      await client.query(query, values);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to save audit log:', error);
    return { success: false, error };
  }
}

export async function saveScanIssueToDb(domain: string, issue: any) {
  const query = `
    INSERT INTO scan_issues (domain, issue_type, severity, description, created_at)
    VALUES ($1, $2, $3, $4, NOW())
  `;
  const values = [
    sanitize(domain),
    sanitize(issue.type),
    sanitize(issue.severity),
    sanitize(issue.description)
  ];
  try {
    const client = await pool.connect();
    try {
      await client.query(query, values);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to save scan issue:', error);
    return { success: false, error };
  }
}

export async function getBotStatus(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT is_active FROM bot_settings WHERE id = 1');
      return res.rows[0]?.is_active ?? true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to get bot status:', error);
    throw error;
  }
}

export async function setBotStatus(isActive: boolean) {
  try {
    const client = await pool.connect();
    try {
      await client.query('UPDATE bot_settings SET is_active = $1, updated_at = NOW() WHERE id = 1', [isActive]);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to set bot status:', error);
    return { success: false, error };
  }
}

export async function getNextQueueItem() {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT id, url FROM scan_queue ORDER BY created_at ASC LIMIT 1');
      return res.rows[0] || null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to get queue item:', error);
    throw error;
  }
}

export async function getQueueSize(): Promise<number> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT COUNT(*) FROM scan_queue');
      return parseInt(res.rows[0].count);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to get queue size:', error);
    return 0;
  }
}

export async function removeFromQueue(id: number) {
  try {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM scan_queue WHERE id = $1', [id]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to remove from queue:', error);
  }
}

export async function addToQueue(url: string) {
  try {
    const client = await pool.connect();
    try {
      await client.query('INSERT INTO scan_queue (url) VALUES ($1) ON CONFLICT (url) DO NOTHING', [url]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to add to queue:', error);
  }
}

export async function getViolations() {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM scan_issues ORDER BY created_at DESC');
      return res.rows.map(issue => ({
        ...issue,
        domain: sanitize(issue.domain),
        issue_type: sanitize(issue.issue_type),
        description: sanitize(issue.description)
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to fetch violations:', error);
    return [];
  }
}

export async function getStats() {
  try {
    const client = await pool.connect();
    try {
      const pagesRes = await client.query('SELECT COUNT(*) as count FROM audit_logs');
      const issuesRes = await client.query('SELECT COUNT(*) as count FROM scan_issues');
      const recentIssues = await client.query('SELECT * FROM scan_issues ORDER BY created_at DESC LIMIT 50');
      
      const sanitizedRecentIssues = recentIssues.rows.map(issue => ({
        ...issue,
        domain: sanitize(issue.domain),
        issue_type: sanitize(issue.issue_type),
        description: sanitize(issue.description)
      }));

      return {
        pagesScanned: parseInt(pagesRes.rows[0].count),
        issuesFound: parseInt(issuesRes.rows[0].count),
        recentIssues: sanitizedRecentIssues
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to get stats:', error);
    return { pagesScanned: 0, issuesFound: 0, recentIssues: [] };
  }
}