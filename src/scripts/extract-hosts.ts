
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * @fileOverview Website Extractor V3.0 "Multi-Source Crawler"
 * Собирает домены компаний из государственных реестров и бизнес-каталогов ЕС.
 * Поддерживает пагинацию и мульти-региональный поиск.
 */

if (!process.env.DATABASE_URL) {
  console.error('[Extractor] ERROR: DATABASE_URL is missing in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Конфигурация источников
const SOURCES = [
  {
    name: 'GelbeSeiten (Germany)',
    baseUrl: 'https://www.gelbeseiten.de/suche/software/seite-',
    pages: 10,
    selector: 'a[href*="http"]'
  },
  {
    name: 'PagineGialle (Italy)',
    baseUrl: 'https://www.paginegialle.it/lazio/roma/software.html?p=',
    pages: 10,
    selector: 'a.contact-link, a[data-id="website"]'
  },
  {
    name: 'WKO (Austria)',
    baseUrl: 'https://firmen.wko.at/Suche.aspx?S=software&p=',
    pages: 5,
    selector: 'a.title-link, a[href*="http"]'
  }
];

const FORBIDDEN_DOMAINS = [
  'europages', 'kompass', 'google', 'facebook', 'linkedin', 
  'twitter', 'instagram', 'youtube', 'pinterest', 'apple',
  'microsoft', 'amazon', 'adobe', 'gstatic', 'doubleclick',
  'gelbeseiten', 'paginegialle', 'pagesjaunes', 'wko.at',
  'mapquest', 'bing', 'yandex', 'wikipedia', 'schema.org'
];

async function extract() {
  console.log('==================================================');
  console.log('   HUMANGO MULTI-SOURCE EXTRACTOR V3.0            ');
  console.log('   Mode: Autonomous Discovery & Pagination        ');
  console.log('==================================================');
  
  const client = await pool.connect();
  
  try {
    for (const source of SOURCES) {
      console.log(`\n[Source] Starting collection from: ${source.name}`);
      
      for (let page = 1; page <= source.pages; page++) {
        const catalogUrl = `${source.baseUrl}${page}`;
        console.log(`  [Page ${page}] Fetching: ${catalogUrl}`);
        
        try {
          const { data } = await axios.get(catalogUrl, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.google.com/'
            },
            timeout: 15000
          });
          
          const $ = cheerio.load(data);
          const foundWebsites: Set<string> = new Set();

          $(source.selector).each((_, el) => {
            let href = $(el).attr('href');
            if (href) {
              try {
                // Очистка от редиректов (часто встречается в каталогах)
                if (href.includes('?url=')) href = decodeURIComponent(href.split('?url=')[1].split('&')[0]);
                if (href.includes('&url=')) href = decodeURIComponent(href.split('&url=')[1].split('&')[0]);
                
                const url = new URL(href);
                const hostname = url.hostname.toLowerCase().replace('www.', '');
                
                const isForbidden = FORBIDDEN_DOMAINS.some(d => hostname.includes(d));
                const isHttp = ['http:', 'https:'].includes(url.protocol);
                const isTldAllowed = hostname.includes('.') && hostname.length > 4;
                
                if (!isForbidden && isHttp && isTldAllowed) {
                  foundWebsites.add(`${url.protocol}//${url.hostname}`);
                }
              } catch (e) {
                // Невалидный URL
              }
            }
          });

          if (foundWebsites.size > 0) {
            let insertedCount = 0;
            for (const site of foundWebsites) {
              try {
                const res = await client.query(
                  `INSERT INTO public.scan_queue (url, status, priority) 
                   VALUES ($1, 'pending', 1) 
                   ON CONFLICT (url) DO NOTHING;`,
                  [site.toLowerCase()]
                );
                if (res.rowCount && res.rowCount > 0) insertedCount++;
              } catch (dbErr) { }
            }
            console.log(`    -> Success: Found ${foundWebsites.size} candidates, queued ${insertedCount} new targets.`);
          } else {
            console.log(`    -> Warning: No websites found on this page.`);
          }

          // Политкорректная задержка между страницами
          await new Promise(r => setTimeout(r, 2000));

        } catch (fetchErr: any) {
          console.warn(`    [!] Error on page ${page}: ${fetchErr.message}`);
          // Если получили 403 или 429, пропускаем оставшиеся страницы этого источника
          if (fetchErr.response?.status === 403 || fetchErr.response?.status === 429) {
            console.error(`    [!!] Blocked by ${source.name}. Skipping to next source.`);
            break;
          }
        }
      }
    }
    
    console.log('\n==================================================');
    console.log('[Extractor] Discovery operation complete.');
  } catch (err: any) {
    console.error('[Extractor] Critical failure:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

extract();
