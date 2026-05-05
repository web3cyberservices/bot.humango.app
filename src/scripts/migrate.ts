import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        status_code INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migration] Table audit_logs created or already exists.');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scan_issues (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        issue_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migration] Table scan_issues created or already exists.');
    
    console.log('[Migration] Completed successfully.');
  } catch (err) {
    console.error('[Migration] Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
