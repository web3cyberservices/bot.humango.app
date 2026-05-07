
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting database schema initialization...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        status_code INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_results (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        issue_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        evidence_html TEXT,
        description TEXT,
        recommendation TEXT,
        scan_type VARCHAR(20) DEFAULT 'basic',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_events (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT one_row CHECK (id = 1)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scan_queue (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO bot_settings (id, is_active)
      VALUES (1, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO scan_queue (url, status)
      VALUES 
        ('https://google.com', 'pending'),
        ('https://github.com', 'pending')
      ON CONFLICT (url) DO NOTHING;
    `);
    
    console.log('[Migration] All tables and initial data created successfully.');
  } catch (err) {
    console.error('[Migration] Critical Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
