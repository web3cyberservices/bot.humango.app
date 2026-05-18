
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('[Migration] ERROR: DATABASE_URL is not defined in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('==================================================');
    console.log('   HUMANGO COMPLIANCE DATABASE MIGRATOR V35.0     ');
    console.log('   Action: Full Sync (PostgreSQL Only)            ');
    console.log('==================================================');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        name varchar(255),
        created_at timestamp DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bot_settings (
        id int DEFAULT 1 PRIMARY KEY, 
        is_active boolean DEFAULT true, 
        updated_at timestamp DEFAULT NOW()
      );
      
      INSERT INTO public.bot_settings (id, is_active) 
      VALUES (1, true) 
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS public.scan_queue (
        id SERIAL PRIMARY KEY, 
        url text UNIQUE, 
        status varchar(20) DEFAULT 'pending', 
        priority int DEFAULT 0, 
        user_email varchar(255),
        assigned_to varchar(255),
        manager_name varchar(255),
        assigned_at timestamp,
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
        description text,
        law_name text,
        recommendation text,
        business_impact text,
        report_type character varying(20) DEFAULT 'SaaS',
        created_at timestamp DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.bot_events (
        id SERIAL PRIMARY KEY, 
        type varchar(20), 
        message text, 
        timestamp timestamp DEFAULT NOW()
      );
    `);

    // Ensure CRM columns exist in scan_queue
    const columns = [
      { table: 'scan_queue', name: 'assigned_to', type: 'varchar(255)' },
      { table: 'scan_queue', name: 'manager_name', type: 'varchar(255)' },
      { table: 'scan_queue', name: 'assigned_at', type: 'timestamp' },
      { table: 'scan_queue', name: 'user_email', type: 'varchar(255)' }
    ];

    for (const col of columns) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${col.table}' AND column_name='${col.name}') THEN
            ALTER TABLE public.${col.table} ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }
    
    console.log('[Migration] SUCCESS: Database synchronized.');
  } catch (err: any) {
    console.error('[Migration] CRITICAL ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
