import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

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
