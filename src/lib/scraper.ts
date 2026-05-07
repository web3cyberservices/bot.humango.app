
import settings from '@/config/crawler-settings.json';
import { shouldRunDeepScan } from './parser';
import puppeteer from 'puppeteer';
import { ScanType } from '@/types';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT = 10000;
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

/**
 * Глубокое сканирование для обнаружения динамических нарушений.
 */
async function deepScrapeUrl(url: string) {
  console.log(`[Scraper] Deep Scan: Launching Chrome for ${url}`);
  
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
    console.error('[Scraper] Chrome launch failed:', error.message);
    throw new Error('CHROME_LAUNCH_FAILED');
  }

  try {
    const page = await browser.newPage();
    
    // Safety timeout for the entire page logic
    await page.setDefaultNavigationTimeout(25000);
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'media', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`[Scraper] Navigating: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle0', // Wait until network is idle
      timeout: 25000 
    });

    const html = await page.content();
    const cookies = await page.cookies();
    
    return { html, cookies };
  } catch (error: any) {
    console.error(`[Scraper] Puppeteer error for ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      console.log('[Scraper] Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Гибридный скрейпинг: Fetch -> Heuristic -> Puppeteer.
 */
export async function scrapeUrl(url: string, redirectCount = 0): Promise<{html: string, security: any, rawHeaders: any, scanType: ScanType, dynamicCookies?: any[]}> {
  if (redirectCount > MAX_REDIRECTS) throw new Error('REDIRECT_LOOP');

  try {
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

    if (shouldRunDeepScan(html)) {
      try {
        const deepResult = await deepScrapeUrl(url);
        html = deepResult.html;
        dynamicCookies = deepResult.cookies;
        scanType = 'deep';
      } catch (e: any) {
        console.warn(`[Scraper] Deep scan failed, falling back to basic result: ${e.message}`);
      }
    }

    return { html, rawHeaders: headers, security, scanType, dynamicCookies };
  } catch (error: any) {
    console.error(`[Scraper] Fetch failed for ${url}:`, error.message);
    throw error;
  }
}
