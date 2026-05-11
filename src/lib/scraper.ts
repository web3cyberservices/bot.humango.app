
'use server';

import settings from '@/config/crawler-settings.json';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { logger } from './logger';

const REQUEST_TIMEOUT = 10000; // 10s Speed Phase
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

export interface ScrapeResult {
  html: string;
  status: 'success' | 'fail';
  method: 'fetch' | 'puppeteer';
  rawHeaders: any;
  screenshot?: string;
  cookies?: any[];
  duration_ms: number;
  memory_usage_mb: number;
}

/**
 * Phase "BRUTEFORCE": Headless Chrome for complex SPAs or blocked sites.
 */
async function bruteForceScrape(url: string): Promise<Partial<ScrapeResult>> {
  logger.info(`Phase BRUTEFORCE: Launching Puppeteer for ${url}`);
  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--js-flags="--max-old-space-size=1024"'
      ]
    });

    const page = await browser.newPage();
    
    // Resource Optimization: Block non-essential assets to save bandwidth/RAM
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(settings.userAgent);
    await page.setExtraHTTPHeaders({
      'DNT': '1',
      'Sec-GPC': '1',
      'X-Compliance-Portal': 'https://bot.humango.app'
    });

    // Ahmad Requirement: Strict 30s timeout
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Detect WAF / Block
    if (response && [403, 429].includes(response.status())) {
      return { status: 'fail', method: 'puppeteer', rawHeaders: { 'x-waf-block': 'true' } };
    }

    const html = await page.content();
    const cookies = await page.cookies();
    const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });

    return { html, cookies, screenshot: screenshot as string, method: 'puppeteer', status: 'success' };
  } catch (err: any) {
    logger.error(`Bruteforce Phase failed: ${err.message}`);
    return { status: 'fail', method: 'puppeteer' };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Master Scraper Coordinator: Speed -> Surgery -> Bruteforce
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  let method: 'fetch' | 'puppeteer' = 'fetch';
  let html = '';
  let status: 'success' | 'fail' = 'success';
  let headers: any = {};
  let screenshot: string | undefined;
  let cookies: any[] = [];

  try {
    // PHASE 1: SPEED (Fetch)
    const response = await fetch(url, {
      headers: {
        'User-Agent': settings.userAgent,
        'DNT': '1',
        'Sec-GPC': '1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });

    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    if (response.ok) {
      html = await response.text();
      const $ = cheerio.load(html);
      
      // PHASE 2: SURGERY (Cheerio Heuristics)
      const isSPA = $('#app').length > 0 || $('#root').length > 0 || bodyIsEmpty($);
      const hasLegalLinks = $('a').toArray().some(a => {
        const text = $(a).text().toLowerCase();
        return ['impressum', 'privacy', 'datenschutz', 'legal'].some(kw => text.includes(kw));
      });

      // Escalation Trigger
      if (isSPA || !hasLegalLinks) {
        const brute = await bruteForceScrape(url);
        if (brute.status === 'success') {
          html = brute.html!;
          screenshot = brute.screenshot;
          cookies = brute.cookies || [];
          method = 'puppeteer';
        } else {
          status = 'fail';
        }
      }
    } else if ([403, 429].includes(response.status)) {
      // Escalation Trigger: WAF or Rate Limit
      const brute = await bruteForceScrape(url);
      if (brute.status === 'success') {
        html = brute.html!;
        screenshot = brute.screenshot;
        cookies = brute.cookies || [];
        method = 'puppeteer';
      } else {
        status = 'fail';
        headers['x-waf-block'] = 'true';
      }
    } else {
      status = 'fail';
    }
  } catch (err: any) {
    logger.warn(`Speed Phase failed: ${err.message}. Escalating to Bruteforce.`);
    const brute = await bruteForceScrape(url);
    if (brute.status === 'success') {
      html = brute.html!;
      screenshot = brute.screenshot;
      cookies = brute.cookies || [];
      method = 'puppeteer';
    } else {
      status = 'fail';
    }
  }

  return {
    html,
    status,
    method,
    rawHeaders: headers,
    screenshot,
    cookies,
    duration_ms: Date.now() - startTime,
    memory_usage_mb: Math.round((process.memoryUsage().heapUsed - startMemory) / 1024 / 1024)
  };
}

function bodyIsEmpty($: cheerio.CheerioAPI): boolean {
  const bodyText = $('body').text().trim();
  return bodyText.length < 200 && $('script').length > 0;
}
