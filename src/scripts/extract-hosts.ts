
import puppeteer from 'puppeteer';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * @fileOverview HUMANGO GERMAN TARGET EXTRACTOR V3.6
 * Специализированный экстрактор для немецкого сегмента (GelbeSeiten).
 * Использует высокоточные селекторы для извлечения только корпоративных сайтов.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runAutonomousExtractor() {
  console.log('==================================================');
  console.log('   HUMANGO GERMAN TARGET EXTRACTOR V3.6           ');
  console.log('   Target: GelbeSeiten Targeted Business Class    ');
  console.log('==================================================');

  const dbClient = await pool.connect();
  
  // Запуск браузера через Puppeteer (уже в проекте)
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
        await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Небольшая задержка для подгрузки элементов
        await new Promise(r => setTimeout(r, 3000));

        // Ювелирный сбор ссылок через оценку контекста кнопок
        const companySites = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a[href*="http"]'));
          
          return elements
            .map(el => {
              const anchor = el as HTMLAnchorElement;
              const href = anchor.href;
              const text = anchor.textContent?.toLowerCase() || '';
              const html = anchor.innerHTML.toLowerCase();
              
              // Нацеливаемся строго на маркеры официальных сайтов
              const isOfficialLink = 
                text.includes('webseite') || 
                text.includes('homepage') || 
                html.includes('it-icon-homepage') || 
                html.includes('gs_btn');
                
              if (isOfficialLink) {
                return href;
              }
              return null;
            })
            .filter((href): href is string => {
              if (!href) return false;
              try {
                const url = new URL(href);
                const domain = url.hostname.toLowerCase();
                
                // Черный список: исключаем соцсети, сам каталог и рекламные сети
                const forbidden = [
                  'gelbeseiten', 'google', 'facebook', 'instagram', 'twitter', 
                  'linkedin', 'youtube', 'tiktok', 'pinterest', 'apple', 
                  'microsoft', 'bing', 'timmone', 'link.', 'yelp', 'ebay'
                ];
                
                return !forbidden.some(d => domain.includes(d)) && domain.includes('.');
              } catch {
                return false;
              }
            });
        });

        const uniquePageSites = [...new Set(companySites)];
        console.log(`  -> Найдено потенциальных бизнес-сайтов: ${uniquePageSites.length}`);

        let addedCount = 0;
        for (const siteUrl of uniquePageSites) {
          try {
            const urlObj = new URL(siteUrl);
            const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`.toLowerCase();
            
            // Добавляем в очередь сканирования
            const res = await dbClient.query(
              `INSERT INTO public.scan_queue (url, status, priority) 
               VALUES ($1, 'pending', 1) 
               ON CONFLICT (url) DO NOTHING;`,
              [cleanUrl]
            );
            
            if (res.rowCount && res.rowCount > 0) {
              console.log(`     [+] Добавлен новый хост: ${cleanUrl}`);
              addedCount++;
            }
          } catch (e) {}
        }
        console.log(`  -> Успешно занесено новых целей: ${addedCount}`);
        
      } catch (pageErr: any) {
        console.warn(`  [!] Ошибка при парсинге страницы ${i}: ${pageErr.message}`);
      }
      
      // Политкорректная пауза между страницами
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err: any) {
    console.error('[Critical Error]:', err.message);
  } finally {
    await browser.close();
    dbClient.release();
    await pool.end();
    console.log('==================================================');
    console.log('[Extractor] Сессия сбора данных завершена.');
  }
}

runAutonomousExtractor();
