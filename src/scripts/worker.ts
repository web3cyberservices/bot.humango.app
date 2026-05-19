
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { generatePdfReport } from '../lib/report-generator';
import { checkAndFeedQueue } from './autoSeeder';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.beget.com',
  port: 2525, 
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, 
  },
  tls: {
    rejectUnauthorized: false
  }
});

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "HumangoBot/1.0 (+https://bot.humango.app)"
];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const LEGAL_MARKERS = ['privacy', 'policy', 'terms', 'gdpr', 'datenschutz', 'personal data', 'information we collect', 'cookies', 'legal notice', 'impressum'];
const FINANCE_KEYWORDS = ['credit card', 'payment', 'billing', 'transaction', 'bank', 'wallet', 'purchases', 'checkout', 'financial info'];
const SECURE_KEYWORDS = ['stripe', 'paypal', 'pci-dss', 'secure gateway', 'braintree', 'encrypted', 'certified'];
const RIGHTS_KEYWORDS = ['withdraw', 'right to access', 'erasure', 'right to be forgotten', 'delete account', 'access your data', 'rectification'];

async function randomDelay(min = 1000, max = 3000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeContactsFromPage(page: puppeteer.Page) {
  return await page.evaluate(() => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;
    const text = document.body.innerText;
    const emails = [...new Set(text.match(emailRegex) || [])];
    const phones = [...new Set(text.match(phoneRegex) || [])];
    
    // Find interesting links
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => {
        const h = href.toLowerCase();
        return h.includes('contact') || h.includes('impressum') || h.includes('about') || h.includes('legal');
      });

    return { emails, phones, deepLinks: [...new Set(links)] };
  });
}

async function executeDeterministicAudit(taskId: number, domainUrl: string, userEmail: string) {
  let browser: any = null;
  const networkUrls: string[] = [];
  const finalFindings: any[] = [];
  let leadScore = 0;
  let allExtractedEmails = new Set<string>();
  let allExtractedPhones = new Set<string>();
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);

    await page.setRequestInterception(true);
    page.on('request', request => {
      networkUrls.push(request.url().toLowerCase());
      request.continue();
    });

    let cleanUrl = domainUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const urlObj = new URL(cleanUrl);
    const domainName = urlObj.hostname;
    const tld = domainName.split('.').pop()?.toLowerCase() || '';
    const countryCode = tld === 'com' || tld === 'net' ? 'EU' : tld.toUpperCase();

    console.log(`[Audit Engine] Analyzing: ${domainName}`);
    await page.goto(urlObj.origin, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // Human-like behavior
    await page.mouse.wheel(0, 500);
    await randomDelay(1000, 2000);

    // --- CONTACT SCRAPING ---
    const initialContacts = await scrapeContactsFromPage(page);
    initialContacts.emails.forEach(e => allExtractedEmails.add(e));
    initialContacts.phones.forEach(p => allExtractedPhones.add(p));

    // Deep dive for contacts if needed
    for (const link of initialContacts.deepLinks.slice(0, 3)) {
      try {
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
        const deepContacts = await scrapeContactsFromPage(page);
        deepContacts.emails.forEach(e => allExtractedEmails.add(e));
        deepContacts.phones.forEach(p => allExtractedPhones.add(p));
        await randomDelay(500, 1500);
      } catch (e) {}
    }

    // --- COMPLIANCE AUDIT ---
    // (Existing Audit Logic remains, optimized)
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    // 1. Network & Cookies
    const hasGoogleFonts = networkUrls.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'));
    if (hasGoogleFonts) {
      leadScore += 5;
      finalFindings.push({
        type: 'GOOGLE_FONTS_PRIVACY_VIOLATION',
        basis: 'Art. 6(1)(a) GDPR',
        summary: 'External Google Fonts are loaded directly from US servers, transmitting user IP addresses without consent.',
        risk: 'High risk of automated legal warnings (Abmahnung) in DACH region.',
        liability: 'Up to €250,000 per claim.',
        action: 'Self-host fonts locally.',
        country: countryCode
      });
    }

    const hasAnalytics = networkUrls.some(url => url.includes('google-analytics.com') || url.includes('analytics.google'));
    if (hasAnalytics) {
      leadScore += 20;
      finalFindings.push({
        type: 'TRACKING_TRAFFIC_DETECTED',
        basis: 'Art. 6 GDPR',
        summary: 'Marketing scripts activated before user interaction.',
        risk: 'Critical violation of Planet49 ruling.',
        liability: 'Up to 4% turnover.',
        action: 'Block tracking scripts until opt-in.',
        country: countryCode
      });
    }

    // 2. Legal Presence
    const markerCount = LEGAL_MARKERS.filter(m => pageText.includes(m.toLowerCase())).length;
    if (pageText.length < 400 || markerCount < 2) {
      leadScore += 100;
      finalFindings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        basis: 'Art. 13 GDPR',
        summary: 'No valid Privacy Policy or legal disclosure identified.',
        risk: 'Immediate trigger for regulatory sanctions.',
        liability: 'Up to €20,000,000.',
        action: 'Create a dedicated /privacy page.',
        country: countryCode
      });
    } else {
      if (!RIGHTS_KEYWORDS.some(kw => pageText.includes(kw))) {
        leadScore += 15;
        finalFindings.push({
          type: 'MISSING_GDPR_RIGHTS',
          basis: 'Art. 15-21 GDPR',
          summary: 'Missing mandatory clauses for data subject rights.',
          risk: 'Liability for information failure.',
          liability: 'GDPR Standard.',
          action: 'Include Right to be Forgotten clauses.',
          country: countryCode
        });
      }
    }

    // --- SAVE TO DB ---
    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           audit_findings = $2,
           extracted_emails = $3,
           extracted_phones = $4,
           priority = $5,
           crm_status = CASE WHEN $1 > 0 THEN 'free' ELSE 'completed' END
       WHERE id = $6`,
      [
        finalFindings.length, 
        JSON.stringify(finalFindings), 
        JSON.stringify([...allExtractedEmails]), 
        JSON.stringify([...allExtractedPhones]), 
        leadScore, 
        taskId
      ]
    );

    // Auto-Automation for HOT leads
    const isHot = finalFindings.some(f => f.type === 'MISSING_CORE_FRAMEWORK');
    const firstEmail = [...allExtractedEmails][0] || userEmail;
    if (isHot && firstEmail && firstEmail.length > 5) {
       // Optional: Auto-sending could be disabled as per user request for manual-only
       // But keeping for potential system capability
       console.log(`[Worker] Detected HOT lead: ${domainName}. Contacts extracted: ${[...allExtractedEmails].join(',')}`);
    }

  } catch (err: any) {
    console.error(`[Worker Error] Task ${taskId} failed:`, err.message);
    await pool.query("UPDATE scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function executeCatalogScrape(taskId: number, url: string) {
  console.log(`[Worker] Scraping catalog: ${url}`);
  let browser: any = null;
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENTS[0]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="http"]'));
      return anchors.map(a => (a as HTMLAnchorElement).href);
    });

    const blacklist = ['google.', 'facebook.', 'linkedin.', 'youtube.', 'twitter.', 'instagram.', 'yelp.'];
    const filtered = [...new Set(links)]
      .filter(l => {
        try {
          const host = new URL(l).hostname.toLowerCase();
          return !blacklist.some(b => host.includes(b));
        } catch { return false; }
      })
      .map(l => { try { return new URL(l).origin; } catch { return null; } })
      .filter(Boolean);

    for (const site of filtered.slice(0, 15)) {
      await pool.query(
        "INSERT INTO public.scan_queue (url, status, job_type, priority) VALUES ($1, 'pending', 'audit', 1) ON CONFLICT (url) DO NOTHING",
        [site]
      );
    }
    await pool.query("UPDATE scan_queue SET status = 'completed' WHERE id = $1", [taskId]);
  } catch (e) {
    await pool.query("UPDATE scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function executeDorkSearch(taskId: number, dork: string) {
  console.log(`[Worker] Dork search: ${dork}`);
  let browser: any = null;
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENTS[0]);
    
    // Use DuckDuckGo to avoid Google CAPTCHAs
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(dork)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    const links = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('a.result__a'));
      return results.map(a => (a as HTMLAnchorElement).href);
    });

    for (const site of links.slice(0, 10)) {
      try {
        const origin = new URL(site).origin;
        await pool.query(
          "INSERT INTO public.scan_queue (url, status, job_type, priority) VALUES ($1, 'pending', 'audit', 5) ON CONFLICT (url) DO NOTHING",
          [origin]
        );
      } catch {}
    }
    await pool.query("UPDATE scan_queue SET status = 'completed' WHERE id = $1", [taskId]);
  } catch (e) {
    await pool.query("UPDATE scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  console.log('[Worker] Starting autonomous compliance engine...');
  while (true) {
    try {
      // 1. Check if we need more seeds
      await checkAndFeedQueue();

      // 2. Pick up a task
      const res = await pool.query(
        "SELECT id, url, user_email, job_type FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );

      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        
        if (task.job_type === 'catalog_scrape') {
          await executeCatalogScrape(task.id, task.url);
        } else if (task.job_type === 'dork_search') {
          await executeDorkSearch(task.id, task.url);
        } else {
          await executeDeterministicAudit(task.id, task.url, task.user_email);
        }
      } else {
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (e: any) {
      console.error('[Worker Loop Error]', e.message);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

startWorker();
