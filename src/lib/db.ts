import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function saveAuditLog(domain: string, statusCode: number, errorMessage: string | null) {
  const query = `
    INSERT INTO audit_logs (domain, status_code, error_message, created_at)
    VALUES ($1, $2, $3, NOW())
  `;
  const values = [domain, statusCode, errorMessage];

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
  const values = [domain, issue.type, issue.severity, issue.description];

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
    return true; // Default to true if DB fails
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

export async function getStats() {
  try {
    const client = await pool.connect();
    try {
      const pagesRes = await client.query('SELECT COUNT(*) as count FROM audit_logs');
      const issuesRes = await client.query('SELECT COUNT(*) as count FROM scan_issues');
      const recentIssues = await client.query('SELECT * FROM scan_issues ORDER BY created_at DESC LIMIT 50');
      
      return {
        pagesScanned: parseInt(pagesRes.rows[0].count),
        issuesFound: parseInt(issuesRes.rows[0].count),
        recentIssues: recentIssues.rows
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Error] Failed to get stats:', error);
    return { pagesScanned: 0, issuesFound: 0, recentIssues: [] };
  }
}
