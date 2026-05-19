
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
    console.log('[Migration] Starting database update...');
    
    // Scan Queue Core
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
        audit_findings jsonb DEFAULT '[]'::jsonb,
        extracted_emails jsonb DEFAULT '[]'::jsonb,
        extracted_phones jsonb DEFAULT '[]'::jsonb,
        closing_price decimal(12,2),
        pdf_report_path varchar(500)
      );
    `);

    // Violations Table (Fallback for old logic)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.site_violations (
        id SERIAL PRIMARY KEY,
        domain varchar(255),
        issue_type varchar(255),
        severity varchar(50),
        description text,
        law_name text,
        recommendation text,
        business_impact text,
        potential_fine text,
        country varchar(10),
        created_at timestamp DEFAULT NOW()
      );
    `);

    // Ensure columns exist in site_violations
    const violationCols = [
      { name: 'potential_fine', type: 'text' },
      { name: 'country', type: 'varchar(10)' },
      { name: 'law_name', type: 'text' },
      { name: 'business_impact', type: 'text' }
    ];

    for (const col of violationCols) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_violations' AND column_name='${col.name}') THEN
            ALTER TABLE public.site_violations ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // Ensure columns exist in scan_queue
    const queueCols = [
      { name: 'audit_findings', type: 'jsonb DEFAULT \'[]\'::jsonb' },
      { name: 'extracted_emails', type: 'jsonb DEFAULT \'[]\'::jsonb' },
      { name: 'extracted_phones', type: 'jsonb DEFAULT \'[]\'::jsonb' },
      { name: 'closing_price', type: 'decimal(12,2)' },
      { name: 'priority', type: 'int DEFAULT 0' },
      { name: 'pdf_report_path', type: 'varchar(500)' }
    ];

    for (const col of queueCols) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scan_queue' AND column_name='${col.name}') THEN
            ALTER TABLE public.scan_queue ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    console.log('[Migration] SUCCESS: All tables and columns synchronized.');
  } catch (err: any) { 
    console.error('[Migration] ERROR:', err.message); 
  } finally { 
    client.release(); 
    await pool.end(); 
  }
}

migrate();
