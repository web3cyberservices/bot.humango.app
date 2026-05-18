
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
    console.log('   HUMANGO COMPLIANCE DATABASE MIGRATOR V37.0     ');
    console.log('==================================================');
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        name varchar(255),
        created_at timestamp DEFAULT NOW()
      );
    `);

    // Bot settings
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

    // Enhanced Scan Queue for CRM
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
        auto_message_sent boolean DEFAULT false,
        auto_message_sent_at timestamp
      );
    `);

    // Ensure all CRM columns exist (for existing tables)
    const columns = [
      { name: 'assigned_to', type: 'int' },
      { name: 'manager_name', type: 'varchar(255)' },
      { name: 'assigned_at', type: 'timestamp' },
      { name: 'crm_status', type: "varchar(20) DEFAULT 'free'" },
      { name: 'violations_count', type: 'int DEFAULT 0' },
      { name: 'contacts', type: "jsonb DEFAULT '{\"emails\": [], \"phones\": [], \"other\": []}'" },
      { name: 'auto_message_sent', type: 'boolean DEFAULT false' },
      { name: 'auto_message_sent_at', type: 'timestamp' }
    ];

    for (const col of columns) {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scan_queue' AND column_name='${col.name}') THEN
            ALTER TABLE public.scan_queue ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // Violations table
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
        report_type varchar(20) DEFAULT 'SaaS',
        created_at timestamp DEFAULT NOW()
      );
    `);

    // Events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bot_events (
        id SERIAL PRIMARY KEY, 
        type varchar(20), 
        message text, 
        timestamp timestamp DEFAULT NOW()
      );
    `);
    
    console.log('[Migration] SUCCESS: Database schema is optimized for CRM V37.0.');
  } catch (err: any) {
    console.error('[Migration] ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
