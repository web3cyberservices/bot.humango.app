
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
  let leadScore = 0;
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

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
    
    // --- 0. EXTRACT CONTACTS ---
    const extractedContacts = await page.evaluate(() => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;
      const text = document.body.innerText;
      const emails = [...new Set(text.match(emailRegex) || [])];
      const phones = [...new Set(text.match(phoneRegex) || [])];
      return { emails, phones };
    });

    // --- 1. NETWORK & COOKIES ---
    const hasGoogleFonts = networkUrls.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'));
    if (hasGoogleFonts) {
      leadScore += 5; // Low priority
      finalFindings.push({
        type: 'GOOGLE_FONTS_PRIVACY_VIOLATION',
        basis: 'Art. 6(1)(a) GDPR',
        summary: 'External Google Fonts are loaded directly from US servers, transmitting user IP addresses without consent.',
        risk: 'High risk of automated legal warnings (Abmahnung) in DACH region.',
        liability: 'Up to €250,000 per claim or GDPR standard fines.',
        action: 'Self-host fonts locally and remove external calls to googleapis.com.',
        country: countryCode
      });
    }

    const hasAnalytics = networkUrls.some(url => url.includes('google-analytics.com') || url.includes('analytics.google'));
    const hasFacebook = networkUrls.some(url => url.includes('connect.facebook.net') || url.includes('facebook.com/tr'));
    if (hasAnalytics || hasFacebook) {
      leadScore += 20;
      finalFindings.push({
        type: 'TRACKING_TRAFFIC_DETECTED',
        basis: 'Art. 5(1)(a) & Art. 6 GDPR',
        summary: 'Marketing and analytics scripts were activated automatically before any user interaction.',
        risk: 'Critical violation of the Planet49 ruling.',
        liability: FINE_GDPR,
        action: 'Configure your consent banner to block all non-essential scripts until opt-in.',
        country: countryCode
      });
    }

    // --- 2. LEGAL DOCUMENT VALIDATION ---
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const markerCount = LEGAL_MARKERS.filter(m => pageText.includes(m.toLowerCase())).length;
    let isValidDocument = (pageText.length > 400 && markerCount >= 2);

    if (!isValidDocument) {
      leadScore += 100; // HOT LEAD - Missing Policy
      finalFindings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        basis: 'Art. 13 GDPR',
        summary: 'No valid statutory legal disclosure or Privacy Policy was identified on the site.',
        risk: 'Immediate trigger for regulatory sanctions.',
        liability: FINE_GDPR,
        action: 'Create a dedicated /privacy page and link it in the footer.',
        country: countryCode
      });
    } else {
      // --- 3. CONTENT ANALYSIS ---
      if (!RIGHTS_KEYWORDS.some(kw => pageText.includes(kw))) {
        leadScore += 15;
        finalFindings.push({
          type: 'MISSING_GDPR_RIGHTS',
          basis: 'Art. 15-21 GDPR',
          summary: 'The policy lacks mandatory clauses regarding user rights (Erasure, Access).',
          risk: 'Liability for failing to inform users about data control.',
          liability: FINE_GDPR,
          action: 'Insert explicit clauses for the "Right to be Forgotten".',
          country: countryCode
        });
      }

      if (FINANCE_KEYWORDS.some(kw => pageText.includes(kw)) && !SECURE_KEYWORDS.some(kw => pageText.includes(kw))) {
        leadScore += 25;
        finalFindings.push({
          type: 'UNSECURED_FINANCIAL_DECLARATION',
          basis: 'Art. 32 GDPR',
          summary: 'Financial processing declared without specifying security frameworks.',
          risk: 'Triggers high-priority security audits.',
          liability: FINE_GDPR,
          action: 'Declare PCI-DSS compliance and usage of secure gateways.',
          country: countryCode
        });
      }
    }

    // --- 4. SAVE RESULTS & SCORING ---
    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           audit_findings = $2,
           contacts = $3,
           priority = $4,
           crm_status = CASE WHEN $1 > 0 THEN 'free' ELSE 'completed' END
       WHERE id = $5`,
      [finalFindings.length, JSON.stringify(finalFindings), JSON.stringify(extractedContacts), leadScore, taskId]
    );

    // --- 5. AUTO-AUTOMATION: SEND EMAIL FOR "HOT" LEADS ---
    const isHotLead = finalFindings.some(f => f.type === 'MISSING_CORE_FRAMEWORK');
    const targetEmail = userEmail || (extractedContacts.emails && extractedContacts.emails[0]);

    if (isHotLead && targetEmail && targetEmail.length > 5) {
      console.log(`[Auto-Pilot] Sending priority report to ${targetEmail} due to MISSING_CORE_FRAMEWORK`);
      const pdfBuffer = await generatePdfReport(domainName, finalFindings);
      if (pdfBuffer) {
        await transporter.sendMail({
          from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
          to: targetEmail,
          subject: `Urgent: Statutory Compliance Risks Detected on ${domainName}`,
          text: `Dear owner of ${domainName},\n\nOur automated audit engine has detected critical statutory compliance risks on your website, including the total absence of a mandatory Privacy Policy (Art. 13 GDPR).\n\nPlease find the attached audit report detailing the risks and potential liabilities.\n\nBest regards,\nHumango Compliance Team`,
          attachments: [{
            filename: `Humango_Audit_${domainName}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }]
        });
        await pool.query('UPDATE public.scan_queue SET auto_message_sent = true, auto_message_sent_at = NOW() WHERE id = $1', [taskId]);
      }
    }

    console.log(`[Audit Engine] Audit for ${domainName} finished. Score: ${leadScore}.`);

  } catch (err: any) {
    console.error(`[Worker Error] Task ${taskId} (${domainUrl}) failed:`, err.message);
    await pool.query("UPDATE scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  console.log('[Worker] Starting prioritised audit engine...');
  while (true) {
    try {
      const res = await pool.query(
        "SELECT id, url, user_email FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );
      if (res.rows.length > 0) {
        const task = res.rows[0];
        console.log(`[Worker] Picking up task ${task.id}: ${task.url}`);
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
