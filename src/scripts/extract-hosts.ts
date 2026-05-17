
import puppeteer from 'puppeteer';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * @fileOverview HUMANGO GERMAN TARGET EXTRACTOR V3.7
 * Метод: Глубокая фильтрация внешних хостов (Blacklist Method).
 * Собирает все ссылки и отсеивает ненужные домены.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Список доменов-паразитов, которые мы гарантированно не хотим сканировать
const BLACKLIST = [
  'gelbeseiten.de',
  'google.',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'pinterest.',
  'tiktok.com',
  'youtube.com',
  'apple.com',
  'android.com',
  'dastelefonbuch.de',
  'dasoertliche.de',
  'timmone.de',
  'goyellow.de',
  'sundon.de',
  'w-medien.de',
  'surveymonkey.',
  'maps.google'
];

async function runAutonomousExtractor() {
  console.log('==================================================');
  console.log('   HUMANGO GERMAN TARGET EXTRACTOR V3.7           ');
  console.log('   Method: Deep External Host Filtering (Puppeteer)');
  console.log('==================================================');

  const dbClient = await pool.connect();
  
  // Запуск браузера (используем уже установленный puppeteer)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  // Маскировка под реального пользователя
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  try {
    // Проходим по первым 10 страницам категории ИТ/Программное обеспечение
    for (let i = 1; i <= 10; i++) {
      const catalogUrl = `https://www.gelbeseiten.de/suche/software/seite-${i}`;
      console.log(`[GelbeSeiten] Сканируем страницу ${i}: ${catalogUrl}`);
      
      try {
        // Ждем полной загрузки сети, чтобы выловить все JS-ссылки
        await page.goto(catalogUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Небольшая задержка для подгрузки элементов
        await new Promise(r => setTimeout(r, 2000));

        // Вытаскиваем абсолютно все http/https ссылки со страницы
        const allLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="http"]'))
            .map(a => (a as HTMLAnchorElement).href);
        });

        // Фильтруем ссылки через наш Блэклист и нормализуем до корня
        const filteredSites = allLinks
          .filter(href => {
            if (!href) return false;
            try {
              const url = new URL(href);
              const hostname = url.hostname.toLowerCase();
              // Если хост содержит хотя бы одно слово из блэклиста — удаляем его
              return !BLACKLIST.some(badDomain => hostname.includes(badDomain));
            } catch {
              return false;
            }
          })
          .map(href => {
            try {
              return new URL(href).origin.toLowerCase();
            } catch {
              return null;
            }
          })
          .filter((u): u is string => u !== null && u.startsWith('http'));

        const uniquePageSites = [...new Set(filteredSites)];
        console.log(`  -> Найдено потенциальных бизнес-сайтов: ${uniquePageSites.length}`);

        let addedCount = 0;
        for (const cleanUrl of uniquePageSites) {
          try {
            // Добавляем в очередь сканирования
            const res = await dbClient.query(
              `INSERT INTO public.scan_queue (url, status, priority) 
               VALUES ($1, 'pending', 1) 
               ON CONFLICT (url) DO NOTHING;`,
              [cleanUrl]
            );
            
            if (res.rowCount && res.rowCount > 0) {
              console.log(`     [+] Добавлен в очередь: ${cleanUrl}`);
              addedCount++;
            }
          } catch (e) {}
        }
        console.log(`  -> Успешно занесено новых целей: ${addedCount}`);
        
      } catch (pageErr: any) {
        console.warn(`  [!] Ошибка при парсинге страницы ${i}: ${pageErr.message}`);
      }
      
      // Политкорректная пауза между страницами
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (err: any) {
    console.error('[Critical Error]:', err.message);
  } finally {
    await browser.close();
    dbClient.release();
    await pool.end();
    console.log('==================================================');
    console.log('[Extractor] Сессия завершена. Очередь наполнена.');
  }
}

runAutonomousExtractor();
