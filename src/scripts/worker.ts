
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
  "HumangoBot/1.0 (+https://bot.humango.app)"
];

const THIRD_PARTY_DOMAINS = [
  'google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 
  'sentry.io', 'segment.com', 'intercom.io', 'crisp.chat', 'zendesk.com', 'drift.com',
  'hubspot.com', 'salesforce.com', 'shopify.com', 'wordpress.org', 'gravatar.com', 'meta.com'
];

const LEGAL_MARKERS = ['privacy', 'policy', 'terms', 'gdpr', 'datenschutz', 'personal data', 'cookies', 'legal notice', 'impressum'];
const ENTERPRISE_MARKERS = ['enterprise', 'investors', 'shareholders', 'fortune 500', 'bambora', 'hubspot', 'salesforce'];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function scrapeContactsFromPage(page: puppeteer.Page) {
  return await page.evaluate((thirdPartyDomains) => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;
    const text = document.body.innerText;
    
    const getContext = (match: string, fullText: string) => {
      const idx = fullText.indexOf(match);
      if (idx === -1) return '';
      // Get approx 2 sentences around (approx 150 chars)
      const start = Math.max(0, idx - 150);
      const end = Math.min(fullText.length, idx + match.length + 150);
      return fullText.substring(start, end).replace(/\s+/g, ' ').trim();
    };

    const foundEmails = [...new Set(text.match(emailRegex) || [])];
    const emailsWithContext = foundEmails
      .filter(email => {
        const domain = email.split('@')[1]?.toLowerCase();
        return !thirdPartyDomains.some(d => domain.includes(d));
      })
      .map(email => ({ value: email, context: getContext(email, text) }));

    const foundPhones = [...new Set(text.match(phoneRegex) || [])];
    const phonesWithContext = foundPhones.map(phone => ({ value: phone, context: getContext(phone, text) }));
    
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => {
        const h = href.toLowerCase();
        return h.includes('contact') || h.includes('impressum') || h.includes('about') || h.includes('legal');
      });

    return { emails: emailsWithContext, phones: phonesWithContext, deepLinks: [...new Set(links)] };
  }, THIRD_PARTY_DOMAINS);
}

async function executeDeterministicAudit(taskId: number, domainUrl: string, userEmail: string) {
  let browser: any = null;
  const networkUrls: string[] = [];
  const finalFindings: any[] = [];
  let leadScore = 0;
  let allExtractedEmails = new Map<string, string>();
  let allExtractedPhones = new Map<string, string>();
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);

    await page.setRequestInterception(true);
    page.on('request', request => {
      networkUrls.push(request.url().toLowerCase());
      request.continue();
    });

    let cleanUrl = domainUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const urlObj = new URL(cleanUrl);
    const domainName = urlObj.hostname;

    await page.goto(urlObj.origin, { waitUntil: 'networkidle2', timeout: 35000 });
    
    const initialContacts = await scrapeContactsFromPage(page);
    initialContacts.emails.forEach(e => allExtractedEmails.set(e.value, e.context));
    initialContacts.phones.forEach(p => allExtractedPhones.set(p.value, p.context));

    for (const link of initialContacts.deepLinks.slice(0, 2)) {
      try {
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
        const deepContacts = await scrapeContactsFromPage(page);
        deepContacts.emails.forEach(e => allExtractedEmails.set(e.value, e.context));
        deepContacts.phones.forEach(p => allExtractedPhones.set(p.value, p.context));
      } catch (e) {}
    }

    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    if (ENTERPRISE_MARKERS.some(m => pageText.includes(m) || domainName.includes(m))) {
      leadScore -= 50;
    }

    const markerMatchCount = LEGAL_MARKERS.filter(m => pageText.includes(m)).length;
    let legalText = (pageText.length > 300 && markerMatchCount >= 2) ? pageText : '';

    if (!legalText) {
      leadScore += 100;
      finalFindings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        basis: 'Art. 13 GDPR',
        summary: 'No valid Privacy Policy or legal disclosure identified.',
        description: 'Statutory transparency is mandatory. The site architecture lacks a visible link to data processing terms.',
        liability: 'Up to €20,000,000.',
        recommendation: 'ACTION: Create a dedicated /privacy page and link it in the footer.'
      });
    } else {
      // 1. MISSING LEGAL BASES
      const basisKeywords = ['legal basis', 'article 6', 'legitimate interest', 'performance of a contract', 'consent', 'rechtsgrundlage', 'berechtigtes interesse', 'vertragserfüllung'];
      if (!basisKeywords.some(kw => legalText.includes(kw))) {
        leadScore += 25;
        finalFindings.push({
          type: 'MISSING_LEGAL_BASES',
          basis: 'Art. 6 GDPR',
          summary: 'Absence of explicit legal bases for data processing.',
          description: 'The policy does not clearly state under which legal grounds (e.g. Consent, Legitimate Interest) data is processed.',
          liability: 'Up to 4% turnover.',
          recommendation: 'ACTION: Explicitly list Art. 6 legal grounds for each data category.'
        });
      }

      // 2. MISCLASSIFIED PERSONAL DATA
      const ipRegex = /ip address(es)? (are|is) not personal/i;
      if (ipRegex.test(legalText)) {
        leadScore += 40;
        finalFindings.push({
          type: 'MISCLASSIFIED_PERSONAL_DATA',
          basis: 'ECJ Case C-582/14',
          summary: 'IP addresses falsely claimed as non-personal data.',
          description: 'The policy contains misleading information regarding the nature of technical identifiers.',
          liability: 'High risk of regulatory enforcement.',
          recommendation: 'ACTION: Correct policy to reflect that IP addresses are personal data.'
        });
      }

      // 3. VAGUE RETENTION
      const vaguePhrases = ['as long as', 'indefinitely', 'until you request', 'solange sie', 'unbestimmte zeit'];
      if (vaguePhrases.some(v => legalText.includes(v))) {
        leadScore += 15;
        finalFindings.push({
          type: 'VAGUE_RETENTION_PERIOD',
          basis: 'Art. 5(1)(e) GDPR',
          summary: 'Unclear data retention periods.',
          description: 'Storage limitation principle violated by using non-specific timeframes.',
          liability: 'Up to €20M.',
          recommendation: 'ACTION: Define specific periods (e.g. "24 months") or deletion criteria.'
        });
      }

      // 4. MISSING DPO
      const dpoKeywords = ['dpo', 'data protection officer', 'datenschutzbeauftragter'];
      if (!dpoKeywords.some(kw => legalText.includes(kw))) {
        leadScore += 10;
        finalFindings.push({
          type: 'MISSING_DPO_DETAILS',
          basis: 'Art. 13(1)(b) GDPR',
          summary: 'DPO contact details are missing.',
          description: 'Failure to provide a specific point of contact for data protection inquiries.',
          liability: 'Administrative fines.',
          recommendation: 'ACTION: Add DPO email or contact form link.'
        });
      }

      // 5. MISSING INTERNATIONAL TRANSFERS
      const usTrackers = networkUrls.some(u => u.includes('google') || u.includes('facebook') || u.includes('meta'));
      const transferMechanisms = ['standard contractual clauses', 'scc', 'adequacy decision', 'chapter v', 'standardvertragsklauseln', 'us data privacy framework'];
      if (usTrackers && !transferMechanisms.some(kw => legalText.includes(kw))) {
        leadScore += 30;
        finalFindings.push({
          type: 'MISSING_INTERNATIONAL_TRANSFERS',
          basis: 'Schrems II / Chapter V',
          summary: 'Missing US data transfer declarations.',
          description: 'US-based services (Google/Meta) are active, but no transfer safeguards (SCCs) are declared.',
          liability: 'Suspension of data flows.',
          recommendation: 'ACTION: Add declarations for SCCs and Data Privacy Framework.'
        });
      }
    }

    const emailsJson = Array.from(allExtractedEmails.entries()).map(([v, c]) => ({ value: v, context: c }));
    const phonesJson = Array.from(allExtractedPhones.entries()).map(([v, c]) => ({ value: v, context: c }));

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
      [finalFindings.length, JSON.stringify(finalFindings), JSON.stringify(emailsJson), JSON.stringify(phonesJson), Math.max(1, leadScore), taskId]
    );

    console.log(`[Worker] Audit finished for ${domainName}. Score: ${leadScore}`);

  } catch (err: any) {
    console.error(`[Worker Error] Task ${taskId} failed:`, err.message);
    await pool.query("UPDATE scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  console.log('[Worker] Starting autonomous compliance engine...');
  while (true) {
    try {
      await checkAndFeedQueue();
      const res = await pool.query("SELECT id, url, user_email FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1");
      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        await executeDeterministicAudit(task.id, task.url, task.user_email);
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
