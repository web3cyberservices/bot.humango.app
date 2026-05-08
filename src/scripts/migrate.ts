
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
    console.log('[Migration] Starting database schema initialization based on provided schema...');
    
    // audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id SERIAL PRIMARY KEY,
        domain character varying(255) NOT NULL,
        status_code integer,
        error_message text,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // bot_events
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_events (
        id SERIAL PRIMARY KEY,
        type character varying(20) NOT NULL,
        message text,
        "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // bot_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_settings (
        id integer DEFAULT 1 NOT NULL PRIMARY KEY,
        is_active boolean DEFAULT true,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT one_row CHECK (id = 1)
      );
    `);

    // scan_queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.scan_queue (
        id SERIAL PRIMARY KEY,
        url text NOT NULL UNIQUE,
        status character varying(20) DEFAULT 'pending',
        priority integer DEFAULT 0,
        depth integer DEFAULT 0,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        scan_type character varying(255)
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_violations_domain ON public.site_violations USING btree (domain);`);

    // Initial Data
    await client.query(`
      INSERT INTO public.bot_settings (id, is_active)
      VALUES (1, true)
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('[Migration] Schema synchronized successfully.');
  } catch (err) {
    console.error('[Migration] Critical Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
