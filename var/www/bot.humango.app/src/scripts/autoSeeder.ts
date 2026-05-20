import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';

dotenv.config();

const EUROPEAN_B2B_CATALOGS = [
  { url: 'https://www.gelbeseiten.de/suche/software/seite-', pages: 10 },
  { url: 'https://clutch.co/de/agencies?page=', pages: 10 },
  { url: 'https://www.europages.de/unternehmen/Deutschland/software.html?page=', pages: 5 }
];

const SEARCH_DORKS = [
  'site:.de "powered by shopify" -inurl:impressum',
  'site:.at "powered by shopify" -inurl:impressum',
  'site:.it "partita iva" "checkout"',
  'site:.es "aviso legal" "contacto"',
  'site:.fr "mentions legales" "panier"'
];

export async function checkAndFeedQueue(pool: Pool) {
  console.log('[AutoSeeder] Validating queue depth...');
  const client = await pool.connect();
  
  try {
    const res = await client.query("SELECT COUNT(*) FROM public.scan_queue WHERE status = 'pending'");
    const count = parseInt(res.rows[0].count);

    if (count < 5) {
      console.log(`[AutoSeeder] Queue low (${count}). Launching Discovery Mission...`);
      
      const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

      let foundLinks: string[] = [];
      let dorkLinks: string[] = [];

      try {
        // Strategy A: Catalog Crawling
        const randomCatalog = EUROPEAN_B2B_CATALOGS[Math.floor(Math.random() * EUROPEAN_B2B_CATALOGS.length)];
        const pageNum = Math.floor(Math.random() * randomCatalog.pages) + 1;
        const targetUrl = `${randomCatalog.url}${pageNum}`;

        console.log(`[AutoSeeder] Crawling Catalog: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        foundLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .map(a => a.href)
            .filter(href => href.startsWith('http') && !href.includes('google') && !href.includes('facebook') && !href.includes('linkedin'));
        });
      } catch (e) {
        console.log('[AutoSeeder] Catalog crawl skipped due to timeout/block.');
      }

      try {
        // Strategy B: Google Dorking via DuckDuckGo HTML (Bypasses JS checks)
        const randomDork = SEARCH_DORKS[Math.floor(Math.random() * SEARCH_DORKS.length)];
        console.log(`[AutoSeeder] Executing Dork: ${randomDork}`);
        await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(randomDork)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        dorkLinks = await page.evaluate(() => {
          // В HTML-версии DDG ссылки лежат в a.result__url
          const results = Array.from(document.querySelectorAll('a.result__url'));
          return results.map(a => (a as HTMLAnchorElement).href);
        });
      } catch (e) {
        console.log('[AutoSeeder] Dork execution skipped due to timeout/block.');
      }

      const allTargets = [...new Set([...foundLinks, ...dorkLinks])];
      let added = 0;

      for (const url of allTargets) {
        try {
          const domain = new URL(url).origin.toLowerCase();
          // ВАЖНО: Добавили status = 'pending', чтобы воркер увидел задачу!
          const insertRes = await client.query(
            "INSERT INTO public.scan_queue (url, status, crm_status, priority) VALUES ($1, 'pending', 'pending', 5) ON CONFLICT (url) DO NOTHING",
            [domain]
          );
          if (insertRes.rowCount && insertRes.rowCount > 0) added++;
        } catch (e) {}
        if (added >= 10) break;
      }

      console.log(`[AutoSeeder] Mission Success. Added ${added} new high-value targets.`);
      await browser.close();
      return added > 0;
    }
    return false;
  } catch (err: any) {
    console.error('[AutoSeeder Error]', err.message);
    return false;
  } finally {
    client.release();
  }
}