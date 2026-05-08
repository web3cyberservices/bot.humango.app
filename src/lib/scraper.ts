
import settings from '@/config/crawler-settings.json';
import { shouldRunDeepScan } from './parser';
import puppeteer from 'puppeteer';
import { ScanType } from '@/types';
import { logger } from './logger';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT = 15000;
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

/**
 * Глубокое сканирование для обнаружения динамических нарушений и создания скриншотов.
 * Использует изолированные инкогнито-контексты для соблюдения Stateless политики.
 */
async function deepScrapeUrl(url: string) {
  logger.info(`Deep Scan (Headless Chrome) initiating for: ${url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu',
        '--single-process'
      ]
    });
  } catch (error: any) {
    logger.error(`Chrome launch failed: ${error.message}`);
    throw new Error('CHROME_LAUNCH_FAILED');
  }

  try {
    // Создаем изолированный контекст (Incognito), чтобы не сохранять куки и сессии
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    await page.setUserAgent(settings.userAgent);
    
    // Поддержка Privacy-стандартов: DNT: 1 и GPC: 1
    await page.setExtraHTTPHeaders({
      'From': settings.abuseEmail,
      'X-Compliance-Portal': 'https://bot.humango.app',
      'DNT': '1',
      'Sec-GPC': '1'
    });
    
    await page.setDefaultNavigationTimeout(25000);
    
    // Блокируем лишние ресурсы для экономии трафика и ускорения
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['media', 'font', 'image'].includes(type) && !url.includes(req.url())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 25000 
    });

    const screenshot = await page.screenshot({ 
      encoding: 'base64', 
      type: 'jpeg', 
      quality: 40,
      fullPage: false 
    });

    const html = await page.content();
    const cookies = await page.cookies();
    
    // Закрываем контекст немедленно
    await context.close();
    
    return { html, cookies, screenshot };
  } catch (error: any) {
    logger.error(`Puppeteer error for ${url}: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Гибридный скрейпинг: Fetch -> Heuristic -> Puppeteer.
 * С поддержкой Retry-After и Privacy Headers.
 */
export async function scrapeUrl(url: string, redirectCount = 0): Promise<{html: string, security: any, rawHeaders: any, scanType: ScanType, dynamicCookies?: any[], screenshot?: string}> {
  if (redirectCount > MAX_REDIRECTS) throw new Error('REDIRECT_LOOP');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': settings.userAgent,
        'From': settings.abuseEmail,
        'X-Crawler-Contact': settings.abuseEmail,
        'X-Compliance-Portal': 'https://bot.humango.app',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'DNT': '1', // Do Not Track
        'Sec-GPC': '1' // Global Privacy Control
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });

    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get('retry-after');
      const retryReason = retryAfter ? `_RETRY_${retryAfter}` : '';
      throw new Error(`RATE_LIMITED_${response.status}${retryReason}`);
    }

    if (!response.ok) throw new Error(`HTTP_ERROR_${response.status}`);

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
    let screenshot: string | undefined = undefined;

    if (shouldRunDeepScan(html)) {
      try {
        const deepResult = await deepScrapeUrl(url);
        html = deepResult.html;
        dynamicCookies = deepResult.cookies;
        screenshot = deepResult.screenshot;
        scanType = 'deep';
      } catch (e: any) {
        logger.warn(`Deep scan fallback for ${url}: ${e.message}`);
      }
    }

    return { html, rawHeaders: headers, security, scanType, dynamicCookies, screenshot };
  } catch (error: any) {
    if (error.message.includes('RATE_LIMITED')) throw error;
    logger.error(`Fetch failed for ${url}: ${error.message}`);
    throw error;
  }
}
