
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('[Seed] ERROR: DATABASE_URL is not defined in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  const email = 'abuse@humango.app';
  const password = 'Web3p00d@3';
  const name = 'Compliance Manager';

  // Маскируем пароль в логах для безопасности
  const maskedUrl = dbUrl!.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Seed] Connecting to: ${maskedUrl}`);

  const client = await pool.connect();
  try {
    // Сначала убедимся, что таблица существует
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        email varchar(255) UNIQUE NOT NULL,
        password varchar(255) NOT NULL,
        name varchar(255),
        created_at timestamp DEFAULT NOW()
      );
    `);

    const res = await client.query(
      `INSERT INTO public.users (email, password, name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET password = $2, name = $3
       RETURNING id;`,
      [email, password, name]
    );

    console.log(`[Seed] SUCCESS: Manager ${email} is ready in the database (ID: ${res.rows[0].id}).`);
  } catch (error: any) {
    console.error('[Seed] ERROR:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
