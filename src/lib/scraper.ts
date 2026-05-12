
'use server';

import settings from '@/config/crawler-settings.json';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { logger } from './logger';
import fs from 'fs';

const REQUEST_TIMEOUT = 10000;

// Hardened Chrome path detection for various server environments
const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // Let puppeteer try to find it
}

/**
 * V30.0 Security Guard
 * Restricts outbound traffic to ports 80 and 443 only.
 * Strictly enforces legitimate HTTP GET requests.
 */
function validateNetworkTarget(urlStr: string) {
  try {
    const url = new URL(urlStr);
    
    // Rule: Reject raw IPs (Prevention of IP-range scanning)
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(url.hostname)) {
      throw new Error('Direct IP auditing is strictly forbidden. Use domain hostnames.');
    }

    // Rule: Reject forbidden ports (only 80/443 allowed)
    if (url.port && !['80', '443'].includes(url.port)) {
      throw new Error(`Port ${url.port} is blocked. Validator V30.0 only supports ports 80 and 443.`);
    }

    // Rule: Protocol check (HTTP/HTTPS GET only)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Forbidden protocol detected. Only http/https permitted.');
    }
  } catch (e: any) {
    throw new Error(`[Security Guard V30.0] Access Denied: ${e.message}`);
  }
}

async function bruteForceScrape(url: string): Promise<Partial<ScrapeResult>> {
  logger.info(`Phase DYNAMIC: Launching Security-Hardened Puppeteer for ${url}`);
  let browser: any = null;
  try {
    validateNetworkTarget(url);
    
    const executablePath = await getExecutablePath();
    
    browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Security Guard: Intercept and block non-essential or suspicious assets
    // Strictly NO form submission or interaction
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      // Block images, fonts, and stylesheets to save memory and focus on text analysis
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else if (req.method() !== 'GET') {
        // Force GET-only even for dynamic resources
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(settings.userAgent);
    await page.setExtraHTTPHeaders({
      'DNT': '1',
      'Sec-GPC': '1'
    });

    // Iris Feedback: Wait for networkidle2 to ensure all JS fragments are rendered
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    
    if (response && [403, 429].includes(response.status())) {
      return { status: 'fail', method: 'puppeteer', rawHeaders: { 'x-waf-block': 'true' } };
    }

    const html = await page.content();
    const cookies = await page.cookies();
    const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 30 });

    return { html, cookies, screenshot: screenshot as string, method: 'puppeteer', status: 'success' };
  } catch (err: any) {
    logger.error(`Dynamic Phase failed for ${url}: ${err.message}`);
    return { status: 'fail', method: 'puppeteer' };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

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
    validateNetworkTarget(url);

    // PHASE 1: SPEED (Native Fetch - Legitimate GET)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': settings.userAgent,
        'DNT': '1',
        'Sec-GPC': '1'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });

    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    if (response.ok) {
      html = await response.text();
      const $ = cheerio.load(html);
      
      // Determine if dynamic analysis is needed (e.g., for SPAs)
      const isSPA = $('#app').length > 0 || $('#root').length > 0 || $('body').text().trim().length < 300;
      
      if (isSPA) {
        const brute = await bruteForceScrape(url);
        if (brute.status === 'success') {
          html = brute.html!;
          screenshot = brute.screenshot;
          cookies = brute.cookies || [];
          method = 'puppeteer';
        }
      }
    } else if ([403, 429].includes(response.status)) {
      // If blocked, attempt polite dynamic emulation
      const brute = await bruteForceScrape(url);
      if (brute.status === 'success') {
        html = brute.html!;
        screenshot = brute.screenshot;
        method = 'puppeteer';
      } else {
        status = 'fail';
        headers['x-waf-block'] = 'true';
      }
    } else {
      status = 'fail';
    }
  } catch (err: any) {
    const brute = await bruteForceScrape(url);
    if (brute.status === 'success') {
      html = brute.html!;
      screenshot = brute.screenshot;
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
