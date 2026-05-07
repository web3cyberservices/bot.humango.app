
import settings from '@/config/crawler-settings.json';
import { shouldRunDeepScan } from './parser';
import puppeteer from 'puppeteer';
import { ScanType } from '@/types';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT = 10000;

/**
 * Глубокое сканирование для обнаружения динамических нарушений (Cookie Wall, JS-трекеры).
 */
async function deepScrapeUrl(url: string) {
  console.log(`[Scraper] Starting deep scan for: ${url}`);
  
  const executablePath = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';
  console.log('[DEBUG] Launching Chrome from:', executablePath);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu'
      ]
    });
    console.log('[Scraper] Browser launched successfully');
  } catch (error) {
    console.error('[Scraper FATAL] Failed to launch browser:', error);
    throw error;
  }

  try {
    const page = await browser.newPage();
    
    // Блокировка тяжелых ресурсов для экономии RAM
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Отслеживаем установку куки ДО взаимодействия
    const initialCookies: any[] = [];
    page.on('response', async (response) => {
      const setCookie = response.headers()['set-cookie'];
      if (setCookie) initialCookies.push(setCookie);
    });

    console.log(`[Scraper] Navigating to ${url}...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });

    const html = await page.content();
    const cookies = await page.cookies();
    
    return { html, cookies, initialCookies };
  } catch (error: any) {
    console.error(`[Scraper Error] Deep scan failed for ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log(`[Scraper] Browser closed for: ${url}`);
    }
  }
}

/**
 * Гибридный скрейпинг: Fetch -> Heuristic Analysis -> Puppeteer.
 */
export async function scrapeUrl(url: string, redirectCount = 0): Promise<{html: string, security: any, rawHeaders: any, scanType: ScanType, dynamicCookies?: any[]}> {
  if (redirectCount > MAX_REDIRECTS) throw new Error('REDIRECT_LOOP');

  console.log(`[Scraper] Basic fetch: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': settings.userAgent,
      'X-Crawler-Contact': settings.abuseEmail,
      'X-Compliance-Portal': 'https://bot.humango.app'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  let html = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  const security = {
    ssl: url.startsWith('https') ? 'TLS 1.3' : 'None',
    hsts: !!headers['strict-transport-security'],
    csp: !!headers['content-security-policy'] || html.includes('Content-Security-Policy')
  };

  let scanType: ScanType = 'basic';
  let dynamicCookies: any[] = [];

  // Эвристическая проверка: нужен ли Deep Scan (браузер)
  if (shouldRunDeepScan(html)) {
    try {
      console.log(`[Scraper] Potential risks detected. Initiating Deep Scan...`);
      const deepResult = await deepScrapeUrl(url);
      html = deepResult.html;
      dynamicCookies = deepResult.cookies;
      scanType = 'deep';
    } catch (e: any) {
      console.error(`[Scraper] Deep Scan fallback to basic: ${e.message}`);
    }
  }

  return { html, rawHeaders: headers, security, scanType, dynamicCookies };
}
