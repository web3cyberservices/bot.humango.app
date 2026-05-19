
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { generatePdfReport } from '../lib/report-generator';

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

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const USER_AGENT = "HumangoBot/1.0 (+https://bot.humango.app)";
const FINE_GDPR = "Up to €20,000,000 or 4% of global annual turnover.";

const LEGAL_MARKERS = ['privacy', 'policy', 'terms', 'gdpr', 'datenschutz', 'personal data', 'information we collect', 'cookies', 'legal notice', 'impressum'];
const FINANCE_KEYWORDS = ['credit card', 'payment', 'billing', 'transaction', 'bank', 'wallet', 'purchases', 'checkout', 'financial info'];
const SECURE_KEYWORDS = ['stripe', 'paypal', 'pci-dss', 'secure gateway', 'braintree', 'encrypted', 'certified'];
const RIGHTS_KEYWORDS = ['withdraw', 'right to access', 'erasure', 'right to be forgotten', 'delete account', 'access your data', 'rectification'];

async function executeDeterministicAudit(taskId: number, domainUrl: string, userEmail: string) {
  let browser: any = null;
  const networkUrls: string[] = [];
  const finalFindings: any[] = [];
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // 1. NETWORK ANALYTICS
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
    
    // 1.1 Google Fonts
    const hasGoogleFonts = networkUrls.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'));
    if (hasGoogleFonts) {
      finalFindings.push({
        type: 'GOOGLE_FONTS_PRIVACY_VIOLATION',
        basis: 'Art. 6(1)(a) GDPR & Munich Court Precedent',
        summary: 'External Google Fonts are loaded directly from US servers, transmitting user IP addresses without consent.',
        risk: 'High risk of automated legal warnings (Abmahnung) in German-speaking markets.',
        liability: 'Up to €250,000 per claim or GDPR standard fines.',
        action: 'Self-host fonts locally and remove external calls to googleapis.com.',
        country: countryCode
      });
    }

    // 1.2 Tracking Before Consent
    const hasAnalytics = networkUrls.some(url => url.includes('google-analytics.com') || url.includes('analytics.google'));
    const hasFacebook = networkUrls.some(url => url.includes('connect.facebook.net') || url.includes('facebook.com/tr'));
    if (hasAnalytics || hasFacebook) {
      finalFindings.push({
        type: 'TRACKING_TRAFFIC_DETECTED',
        basis: 'Art. 5(1)(a) & Art. 6 GDPR',
        summary: 'Marketing and analytics scripts were activated automatically before any user interaction.',
        risk: 'Critical violation of the Planet49 ruling. High risk of regulatory intervention.',
        liability: FINE_GDPR,
        action: 'Configure your consent banner to block all non-essential scripts until the user clicks "Accept".',
        country: countryCode
      });
    }

    // 1.3 Cookie Inspection
    const cookies = await page.cookies();
    const forbiddenMarkers = ['_ga', '_gid', '_fbp', '_fr', 'ads', 'metrics'];
    const illegalCookies = cookies.filter(c => forbiddenMarkers.some(m => c.name.toLowerCase().includes(m)));

    if (illegalCookies.length > 0) {
      finalFindings.push({
        type: 'COOKIE_CONSENT_VIOLATION',
        basis: 'ePrivacy Directive & Art. 7 GDPR',
        summary: `The system detected ${illegalCookies.length} tracking cookies placed in storage prior to consent.`,
        risk: 'Direct non-compliance with statutory data protection standards.',
        liability: FINE_GDPR,
        action: 'Implement a hard-blocking cookie mechanism for all analytical and tracking providers.',
        country: countryCode
      });
    }

    // 2. LEGAL DOCUMENT VALIDATION
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    // Strict Legal Document Validation (Berkshire Case Prevention)
    const markerCount = LEGAL_MARKERS.filter(m => pageText.includes(m.toLowerCase())).length;
    let isLegalDocument = (pageText.length > 400 && markerCount >= 2);

    if (!isLegalDocument) {
      finalFindings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        basis: 'Art. 13 GDPR',
        summary: 'No valid statutory legal disclosure or Privacy Policy was identified on the site.',
        risk: 'Immediate trigger for regulatory sanctions and advertising account bans.',
        liability: FINE_GDPR,
        action: 'Create a dedicated /privacy page with all mandatory disclosures and link it in the footer.',
        country: countryCode
      });
    } else {
      // 3. DEEP CONTENT ANALYSIS
      
      // 3.1 Data Retention
      const retentionMarkers = ['retention period', 'store for', 'stored for', 'months', 'years', 'period of', 'retain'];
      if (!retentionMarkers.some(m => pageText.includes(m))) {
        finalFindings.push({
          type: 'DATA_RETENTION_GAP',
          basis: 'Art. 13(2)(a) GDPR',
          summary: 'The privacy policy fails to specify mandatory data retention timeframes.',
          risk: 'Violation of the storage limitation principle.',
          liability: FINE_GDPR,
          action: 'Update your policy with specific storage durations for each data category.',
          country: countryCode
        });
      }

      // 3.2 User Rights (DSAR)
      if (!RIGHTS_KEYWORDS.some(kw => pageText.includes(kw))) {
        finalFindings.push({
          type: 'MISSING_GDPR_RIGHTS',
          basis: 'Art. 15-21 GDPR',
          summary: 'The policy lacks mandatory clauses regarding user rights (Erasure, Access, Withdrawal).',
          risk: 'High liability for failing to inform users about their statutory control over data.',
          liability: FINE_GDPR,
          action: 'Insert explicit clauses for the "Right to be Forgotten" and "Right to Withdraw Consent".',
          country: countryCode
        });
      }

      // 3.3 Financial Protection
      if (FINANCE_KEYWORDS.some(kw => pageText.includes(kw)) && !SECURE_KEYWORDS.some(kw => pageText.includes(kw))) {
        finalFindings.push({
          type: 'UNSECURED_FINANCIAL_DECLARATION',
          basis: 'Art. 32 GDPR',
          summary: 'Financial processing declared without specifying security frameworks (PCI-DSS/Encryption).',
          risk: 'Perceived lack of data security frameworks triggers high-priority audits.',
          liability: FINE_GDPR,
          action: 'State clearly that transactions are handled via PCI-DSS compliant gateways like Stripe or PayPal.',
          country: countryCode
        });
      }

      // 3.4 German Compliance (§ 5 DDG)
      if (countryCode === 'DE' || domainName.includes('.de') || pageText.includes('impressum')) {
        const impressumKeywords = ['handelsregister', 'registernummer', 'ihk', 'amtsgericht', 'ust-idnr'];
        if (!impressumKeywords.some(kw => pageText.includes(kw))) {
          finalFindings.push({
            type: 'GERMAN_IMPRESSUM_INCOMPLETE',
            basis: '§ 5 DDG (Germany)',
            summary: 'Mandatory German legal disclosure is missing critical identifiers (Registry/Court info).',
            risk: 'High risk of Abmahnung (legal warning letters) from competitors.',
            liability: 'Up to €50,000 for statutory errors.',
            action: 'Update your Impressum with Registry number, Local Court, and VAT ID.',
            country: 'DE'
          });
        }
      }
    }

    // --- SAVE TO DATABASE ---
    // Clean old results for this domain
    await pool.query("DELETE FROM public.site_violations WHERE domain = $1", [domainName]);
    
    // Save each violation
    for (const f of finalFindings) {
      await pool.query(
        `INSERT INTO public.site_violations (domain, issue_type, severity, description, law_name, recommendation, potential_fine, business_impact, country) 
         VALUES ($1, $2, 'high', $3, $4, $5, $6, $7, $8)`,
        [domainName, f.type, f.summary, f.basis, f.action, f.liability, f.risk, f.country]
      );
    }

    // UPDATE SCAN QUEUE WITH SUMMARY FOR CRM
    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           audit_findings = $2,
           crm_status = CASE WHEN $1 > 0 THEN 'new' ELSE 'completed' END
       WHERE id = $3`,
      [finalFindings.length, JSON.stringify(finalFindings), taskId]
    );

    console.log(`[Audit Engine] COMPLETED: ${domainName}. Found ${finalFindings.length} violations.`);

  } catch (err: any) {
    console.error(`[Worker Error] ${domainUrl}:`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  while (true) {
    try {
      const res = await pool.query(
        "SELECT id, url, user_email FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );
      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        await executeDeterministicAudit(task.id, task.url, task.user_email);
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e: any) {
      console.error('[Worker Loop Error]', e.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

startWorker();
