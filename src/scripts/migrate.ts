
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
    console.log('[Migration] Updating database schema for dual-report architecture...');
    
    // site_violations
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.site_violations (
        id SERIAL PRIMARY KEY,
        domain character varying(255),
        url text,
        category character varying(50),
        issue_type character varying(100),
        severity character varying(20),
        evidence_html text,
        recommendation text,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        page_url text,
        snippet text,
        fine_amount character varying(100),
        explanation text,
        law_name text,
        potential_fine text,
        scan_type character varying(255),
        report_type character varying(20) DEFAULT 'SaaS',
        verification_method character varying(50) DEFAULT 'Static Analysis'
      );
    `);

    // Ensure columns exist (Idempotent updates)
    const columnsToEnsure = [
      { name: 'report_type', type: 'character varying(20)', default: "'SaaS'" },
      { name: 'verification_method', type: 'character varying(50)', default: "'Static Analysis'" },
      { name: 'fine_amount', type: 'character varying(100)', default: 'NULL' }
    ];

    for (const col of columnsToEnsure) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='site_violations' AND COLUMN_NAME='${col.name}') THEN
            ALTER TABLE public.site_violations ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default};
          END IF;
        END $$;
      `);
    }

    // audit_logs, bot_events, bot_settings, scan_queue (ensure they exist)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (id SERIAL PRIMARY KEY, domain varchar(255), status_code int, error_message text, created_at timestamp DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS public.bot_events (id SERIAL PRIMARY KEY, type varchar(20), message text, timestamp timestamp DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS public.bot_settings (id int DEFAULT 1 PRIMARY KEY, is_active boolean DEFAULT true, updated_at timestamp DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS public.scan_queue (id SERIAL PRIMARY KEY, url text UNIQUE, status varchar(20) DEFAULT 'pending', priority int DEFAULT 0, depth int DEFAULT 0, created_at timestamp DEFAULT NOW());
    `);
    
    console.log('[Migration] Database schema is up to date.');
  } catch (err) {
    console.error('[Migration] Critical Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
