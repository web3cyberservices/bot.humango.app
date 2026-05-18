
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  const email = 'abuse@humango.app';
  const password = 'Web3p00d@3';
  const name = 'Compliance Manager';

  console.log(`[Seed] Attempting to create manager in PostgreSQL: ${email}`);

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO public.users (email, password, name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET password = $2, name = $3;`,
      [email, password, name]
    );
    console.log('[Seed] SUCCESS: Manager created/updated in users table.');
  } catch (error) {
    console.error('[Seed] ERROR:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
