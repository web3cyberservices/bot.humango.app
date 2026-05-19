
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
    console.log('==================================================');
    console.log('   HUMANGO COMPLIANCE DATABASE MIGRATOR          ');
    console.log('==================================================');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        name varchar(255),
        created_at timestamp DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_settings (
        id int DEFAULT 1 PRIMARY KEY, 
        is_active boolean DEFAULT true, 
        updated_at timestamp DEFAULT NOW()
      );
      INSERT INTO public.bot_settings (id, is_active) 
      VALUES (1, true) 
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.scan_queue (
        id SERIAL PRIMARY KEY, 
        url text UNIQUE, 
        status varchar(20) DEFAULT 'pending', 
        priority int DEFAULT 0, 
        user_email varchar(255),
        assigned_to int,
        manager_name varchar(255),
        assigned_at timestamp,
        created_at timestamp DEFAULT NOW(),
        crm_status varchar(20) DEFAULT 'free',
        violations_count int DEFAULT 0,
        contacts jsonb DEFAULT '{"emails": [], "phones": [], "other": []}',
        audit_findings jsonb DEFAULT '[]'::jsonb,
        pdf_report_path varchar(500),
        auto_message_sent boolean DEFAULT false,
        auto_message_sent_at timestamp
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.site_violations (
        id SERIAL PRIMARY KEY,
        domain varchar(255),
        url text,
        page_url text,
        category varchar(50),
        issue_type varchar(100),
        severity varchar(20),
        description text,
        law_name text,
        recommendation text,
        business_impact text,
        potential_fine text,
        country varchar(10),
        report_type varchar(20) DEFAULT 'SaaS',
        created_at timestamp DEFAULT NOW()
      );
    `);

    // Ensure all columns exist
    const scanQueueColumns = [
      { name: 'audit_findings', type: 'jsonb DEFAULT \'[]\'::jsonb' },
      { name: 'pdf_report_path', type: 'varchar(500)' }
    ];

    for (const col of scanQueueColumns) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scan_queue' AND column_name='${col.name}') THEN
            ALTER TABLE public.scan_queue ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    const violationsColumns = [
      { name: 'potential_fine', type: 'text' },
      { name: 'law_name', type: 'text' },
      { name: 'recommendation', type: 'text' },
      { name: 'business_impact', type: 'text' },
      { name: 'country', type: 'varchar(10)' }
    ];

    for (const col of violationsColumns) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_violations' AND column_name='${col.name}') THEN
            ALTER TABLE public.site_violations ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_events (
        id SERIAL PRIMARY KEY, 
        type varchar(20), 
        message text, 
        timestamp timestamp DEFAULT NOW()
      );
    `);
    
    console.log('[Migration] SUCCESS: Database schema is optimized.');
  } catch (err: any) {
    console.error('[Migration] ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
