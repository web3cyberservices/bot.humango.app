
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
    console.log('[Migration] Starting robust schema update...');
    
    // Ensure core tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_settings (
        id int DEFAULT 1 PRIMARY KEY, 
        is_active boolean DEFAULT true, 
        updated_at timestamp DEFAULT NOW()
      );
      
      INSERT INTO public.bot_settings (id, is_active) 
      VALUES (1, true) 
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id SERIAL PRIMARY KEY, 
        domain varchar(255), 
        status_code int, 
        error_message text, 
        created_at timestamp DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bot_events (
        id SERIAL PRIMARY KEY, 
        type varchar(20), 
        message text, 
        timestamp timestamp DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.scan_queue (
        id SERIAL PRIMARY KEY, 
        url text UNIQUE, 
        status varchar(20) DEFAULT 'pending', 
        priority int DEFAULT 0, 
        depth int DEFAULT 0, 
        created_at timestamp DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.site_violations (
        id SERIAL PRIMARY KEY,
        domain character varying(255),
        url text,
        page_url text,
        category character varying(50),
        issue_type character varying(100),
        severity character varying(20),
        evidence_html text,
        snippet text,
        description text,
        explanation text,
        law_name text,
        fine_amount character varying(100),
        recommendation text,
        scan_type character varying(255),
        report_type character varying(20) DEFAULT 'SaaS',
        verification_method character varying(50) DEFAULT 'Static Analysis',
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure specific columns exist for older installations
    const columnsToEnsure = [
      { name: 'report_type', type: 'character varying(20)', default: "'SaaS'" },
      { name: 'verification_method', type: 'character varying(50)', default: "'Static Analysis'" },
      { name: 'fine_amount', type: 'character varying(100)', default: 'NULL' },
      { name: 'law_name', type: 'text', default: 'NULL' },
      { name: 'explanation', type: 'text', default: 'NULL' },
      { name: 'recommendation', type: 'text', default: 'NULL' },
      { name: 'snippet', type: 'text', default: 'NULL' },
      { name: 'page_url', type: 'text', default: 'NULL' }
    ];

    for (const col of columnsToEnsure) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='site_violations' AND column_name='${col.name}'
          ) THEN
            ALTER TABLE public.site_violations ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default};
            RAISE NOTICE 'Added column % to site_violations', '${col.name}';
          END IF;
        END $$;
      `);
    }
    
    console.log('[Migration] Database schema is robust and up to date.');
  } catch (err) {
    console.error('[Migration] Critical Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
