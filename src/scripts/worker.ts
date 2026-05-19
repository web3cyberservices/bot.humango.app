import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import path from 'path';
import { checkAndFeedQueue } from './autoSeeder';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const THIRD_PARTY_DOMAINS = ['google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'sentry.io', 'segment.com', 'intercom.io', 'hubspot.com', 'meta.com'];
const LEGAL_MARKERS = ['privacy', 'policy', 'terms', 'gdpr', 'datenschutz', 'personal data', 'information we collect'];

/**
 * ЭТАЛОННАЯ ФУНКЦИЯ АУДИТА V4.0
 */
async function performAudit(page: puppeteer.Page, scanId: number, url: string) {
  const finalFindings: any[] = [];
  let extractedEmails: any[] = [];
  let extractedPhones: any[] = [];
  let hasUS_Trackers = false;
  let legalText = '';
  let leadScore = 0;

  try {
    // --- ШАГ 1: NETWORK & COOKIES ---
    await page.setRequestInterception(true);
    page.on('request', request => {
      const reqUrl = request.url().toLowerCase();
      if (reqUrl.includes('google-analytics') || reqUrl.includes('facebook.com/tr') || reqUrl.includes('doubleclick')) {
        hasUS_Trackers = true;
        if (!finalFindings.some(f => f.type === 'TRACKING_TRAFFIC_DETECTED')) {
          finalFindings.push({
            type: 'TRACKING_TRAFFIC_DETECTED',
            summary: 'Active background tracking detected.',
            description: 'The site transmits data to advertising pixels before/without explicit consent.',
            liability: 'Up to €20M or 4% of turnover.',
            recommendation: 'ACTION: Implement a strict blocking CMP.'
          });
          leadScore += 30;
        }
      }
      request.continue();
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    const cookies = await page.cookies();
    const marketingCookies = cookies.filter(c => ['_ga', '_fbp', '_gcl_au', 'ads'].some(m => c.name.includes(m)));
    if (marketingCookies.length > 0) {
      finalFindings.push({
        type: 'COOKIE_CONSENT_VIOLATION',
        summary: 'Non-essential cookies set before consent.',
        description: `Detected ${marketingCookies.length} marketing/tracking cookies set automatically.`,
        liability: 'GDPR Art. 5(3) ePrivacy violation.',
        recommendation: 'ACTION: Disable automatic cookie placement.'
      });
      leadScore += 40;
    }

    // --- ШАГ 2: STRICT DOCUMENT VALIDATION ---
    const privacyLink = await page.evaluate((markers) => {
      const links = Array.from(document.querySelectorAll('a'));
      const found = links.find(a => markers.some(m => a.innerText.toLowerCase().includes(m)));
      return found ? found.href : null;
    }, ['privacy', 'datenschutz', 'legal', 'policy']);

    let targetLegalUrl = privacyLink || `${new URL(url).origin}/privacy`;
    
    try {
      await page.goto(targetLegalUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      const rawText = await page.evaluate(() => document.body.innerText);
      const isActuallyLegal = LEGAL_MARKERS.some(m => rawText.toLowerCase().includes(m));

      if (rawText.length > 200 && isActuallyLegal) {
        legalText = rawText.toLowerCase();
      } else {
        // Fallback check
        await page.goto(`${new URL(url).origin}/legal/privacy`, { waitUntil: 'networkidle2', timeout: 20000 });
        const secondTry = await page.evaluate(() => document.body.innerText);
        if (secondTry.length > 200 && LEGAL_MARKERS.some(m => secondTry.toLowerCase().includes(m))) {
          legalText = secondTry.toLowerCase();
        }
      }
    } catch (e) {}

    if (!legalText || legalText.length < 200) {
      legalText = '';
      finalFindings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        summary: 'No valid Privacy Policy identified.',
        description: 'The site architecture fails to provide a readable statutory disclosure document.',
        liability: 'Up to €20,000,000.',
        recommendation: 'ACTION: Create and link a /privacy page immediately.'
      });
      leadScore += 100;
    } else {
      // --- ШАГ 3: DEEP SEMANTIC ANALYSIS ---
      
      // 1. Financial
      if (['payment', 'credit card', 'billing', 'rechnung'].some(kw => legalText.includes(kw)) && 
          !['stripe', 'paypal', 'pci-dss', 'klarna'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'UNSECURED_FINANCIAL_DECLARATION', summary: 'Missing payment processor transparency.', description: 'Financial terms found but no secure processor declared.', liability: 'High', recommendation: 'ACTION: Declare Stripe/PayPal integration.' });
        leadScore += 20;
      }

      // 2. GDPR Rights
      if (!['withdraw', 'erasure', 'right to be forgotten', 'löschung', 'auskunft'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_GDPR_RIGHTS', summary: 'Individual rights not fully declared.', description: 'Missing mandatory clauses for data deletion/access.', liability: 'Up to 20M.', recommendation: 'ACTION: Add Art. 15-21 GDPR rights.' });
        leadScore += 30;
      }

      // 3. Legal Bases
      if (!['legal basis', 'article 6', 'legitimate interest', 'rechtsgrundlage', 'berechtigtes interesse'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_LEGAL_BASES', summary: 'Art. 6 legal grounds missing.', description: 'The policy fails to state the legal basis for processing.', liability: 'Critical.', recommendation: 'ACTION: Explicitly cite Art. 6(1) grounds.' });
        leadScore += 50;
      }

      // 4. Misclassified Data
      if (/ip address(es)? (are|is) not personal/i.test(legalText) || /ip-adresse(n)? sind keine personenbezogenen/i.test(legalText)) {
        finalFindings.push({ type: 'MISCLASSIFIED_PERSONAL_DATA', summary: 'IP Address misclassification.', description: 'Incorrect claim that technical identifiers are non-personal.', liability: 'High.', recommendation: 'ACTION: Correct IP data classification.' });
        leadScore += 60;
      }

      // 5. Vague Retention
      if (['as long as', 'indefinitely', 'unbestimmte zeit', 'solange wie nötig'].some(kw => legalText.includes(kw)) || !/\d+ (month|year|monat|jahr)/i.test(legalText)) {
        finalFindings.push({ type: 'VAGUE_RETENTION_PERIOD', summary: 'Unclear storage limitation.', description: 'Vague terms regarding how long data is kept.', liability: 'Art. 5 violation.', recommendation: 'ACTION: Define exact periods (e.g. 24 months).' });
        leadScore += 25;
      }

      // 6. DPO
      if (!['dpo', 'data protection officer', 'datenschutzbeauftragter'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_DPO_DETAILS', summary: 'Statutory contact point missing.', description: 'No DPO or privacy officer contact details found.', liability: 'Administrative fine.', recommendation: 'ACTION: Add DPO email/contact info.' });
        leadScore += 15;
      }

      // 7. Int. Transfers
      if (hasUS_Trackers && !['standard contractual clauses', 'scc', 'adequacy decision', 'standardvertragsklauseln', 'data privacy framework'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_INTERNATIONAL_TRANSFERS', summary: 'Illegal US data transfers.', description: 'Third-party US trackers active without SCC declarations.', liability: 'Suspension of data flows.', recommendation: 'ACTION: Add Standard Contractual Clauses.' });
        leadScore += 45;
      }
    }

    // --- ШАГ 4: CONTACT SCRAPING ---
    const getContext = (text: string, match: string) => {
      const idx = text.indexOf(match);
      return text.substring(Math.max(0, idx - 150), Math.min(text.length, idx + match.length + 150)).replace(/\s+/g, ' ').trim();
    };

    const scrapePageContacts = async (p: puppeteer.Page) => {
      const data = await p.evaluate(() => {
        const txt = document.body.innerText;
        const eRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const pRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;
        return {
          emails: Array.from(new Set(txt.match(eRegex) || [])),
          phones: Array.from(new Set(txt.match(pRegex) || [])),
          fullText: txt
        };
      });
      
      const cleanedEmails = data.emails.filter(e => !THIRD_PARTY_DOMAINS.some(d => e.toLowerCase().includes(d)));
      return {
        emails: cleanedEmails.map(e => ({ value: e, context: getContext(data.fullText, e) })),
        phones: data.phones.map(ph => ({ value: ph, context: getContext(data.fullText, ph) }))
      };
    };

    // Main page extraction
    const mainContacts = await scrapePageContacts(page);
    extractedEmails.push(...mainContacts.emails);
    extractedPhones.push(...mainContacts.phones);

    // Fallback to other pages if needed
    if (extractedEmails.length === 0) {
      const contactLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(h => ['contact', 'impressum', 'about', 'kontakt'].some(kw => h.toLowerCase().includes(kw)));
      });

      for (const link of contactLinks.slice(0, 3)) {
        try {
          await page.goto(link, { waitUntil: 'networkidle2', timeout: 15000 });
          const deep = await scrapePageContacts(page);
          extractedEmails.push(...deep.emails);
          extractedPhones.push(...deep.phones);
        } catch (e) {}
      }
    }

    // De-duplicate
    extractedEmails = Array.from(new Map(extractedEmails.map(e => [e.value, e])).values());
    extractedPhones = Array.from(new Map(extractedPhones.map(p => [p.value, p])).values());

    // --- ШАГ 5: TRIAGE & DB UPDATE ---
    let crmStatus = 'ready_for_sales';
    if (finalFindings.length > 0 && extractedEmails.length === 0) {
      crmStatus = 'needs_analyst';
    } else if (finalFindings.length === 0) {
      crmStatus = 'compliant';
    }

    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           audit_findings = $2,
           extracted_emails = $3,
           extracted_phones = $4,
           priority = $5,
           crm_status = $6
       WHERE id = $7`,
      [finalFindings.length, JSON.stringify(finalFindings), JSON.stringify(extractedEmails), JSON.stringify(extractedPhones), Math.max(1, leadScore), crmStatus, scanId]
    );

    console.log(`[Audit V4.0] ${url} -> ${crmStatus} (Score: ${leadScore}, Found: ${finalFindings.length})`);

  } catch (err: any) {
    console.error(`[Critical Audit Failure] ID ${scanId}:`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE id = $1", [scanId]);
  }
}

async function startWorker() {
  console.log('==================================================');
  console.log('   HUMANGO COMPLIANCE WORKER V4.0 (MONOLITH)      ');
  console.log('==================================================');
  
  const executablePath = await getExecutablePath();
  const browser = await puppeteer.launch({ 
    executablePath, 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });

  while (true) {
    try {
      await checkAndFeedQueue();
      
      const res = await pool.query(
        "SELECT id, url FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );

      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE public.scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        await performAudit(page, task.id, task.url);
        
        await page.close();
      } else {
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (e: any) {
      console.error('[Worker Loop Error]:', e.message);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

startWorker();
