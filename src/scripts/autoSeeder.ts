
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const EUROPEAN_B2B_CATALOGS = [
  { url: 'https://www.gelbeseiten.de/suche/software/seite-', pages: 20 },
  { url: 'https://www.gelbeseiten.de/suche/agentur/seite-', pages: 20 },
  { url: 'https://www.gelbeseiten.de/suche/marketing/seite-', pages: 20 },
  { url: 'https://clutch.co/de/agencies?page=', pages: 10 },
  { url: 'https://www.europages.de/unternehmen/Deutschland/software.html?page=', pages: 5 }
];

const SEARCH_DORKS = [
  'site:.de "powered by shopify" -inurl:impressum',
  'site:.at "powered by shopify" -inurl:impressum',
  'site:.ch "powered by shopify" -inurl:impressum',
  'site:.de "datenschutzerklärung" "kontakt"',
  'site:.it "partita iva" "checkout"'
];

export async function checkAndFeedQueue() {
  console.log('[AutoSeeder] Checking queue depth...');
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT COUNT(*) FROM public.scan_queue WHERE status = 'pending'");
    const count = parseInt(res.rows[0].count);

    if (count < 10) {
      console.log(`[AutoSeeder] Queue low (${count}). Feeding new seeds...`);
      
      // 1. Add some catalog scraping jobs
      const randomCatalog = EUROPEAN_B2B_CATALOGS[Math.floor(Math.random() * EUROPEAN_B2B_CATALOGS.length)];
      const randomPage = Math.floor(Math.random() * randomCatalog.pages) + 1;
      const seedUrl = `${randomCatalog.url}${randomPage}`;

      await client.query(
        "INSERT INTO public.scan_queue (url, job_type, status, priority) VALUES ($1, 'catalog_scrape', 'pending', 5) ON CONFLICT (url) DO NOTHING",
        [seedUrl]
      );

      // 2. Add some dork search jobs
      const randomDork = SEARCH_DORKS[Math.floor(Math.random() * SEARCH_DORKS.length)];
      await client.query(
        "INSERT INTO public.scan_queue (url, job_type, status, priority) VALUES ($1, 'dork_search', 'pending', 8) ON CONFLICT (url) DO NOTHING",
        [randomDork]
      );

      console.log('[AutoSeeder] Seeded new discovery jobs.');
    }
  } catch (e: any) {
    console.error('[AutoSeeder] Error:', e.message);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  checkAndFeedQueue().then(() => pool.end());
}
