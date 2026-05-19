
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

    // 1. NETWORK SNIFFING
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

    console.log(`[EU Scanner] Auditing: ${domainName}`);
    
    await page.goto(urlObj.origin, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // --- GDPR CORE CHECKS ---

    // A. Tracking before consent
    const cookies = await page.cookies();
    const trackerMarkers = ['_ga', '_gid', '_fbp', '_fr', 'ads', 'metrics', 'tt_pixel', 'hotjar'];
    const illegalCookies = cookies.filter(c => trackerMarkers.some(m => c.name.toLowerCase().includes(m)));

    if (illegalCookies.length > 0) {
      finalFindings.push({
        issue_type: 'TRACKING_BEFORE_CONSENT',
        law_name: 'Art. 6 & 7 GDPR (Planet49 Ruling)',
        description: `Identified ${illegalCookies.length} tracking/marketing cookies set before affirmative user consent.`,
        business_impact: 'Critical risk: Direct violation of the landmark Planet49 EU court ruling.',
        potential_fine: FINE_GDPR,
        recommendation: 'ACTION: Implement a hard-blocking mechanism for all non-essential scripts until consent is recorded.',
        country: 'EU'
      });
    }

    // B. Network leakage (Google Fonts / Analytics)
    const hasGoogleFontsDirect = networkUrls.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'));
    if (hasGoogleFontsDirect) {
      finalFindings.push({
        issue_type: 'GOOGLE_FONTS_PRIVACY_VIOLATION',
        law_name: 'Art. 6 GDPR (Munich Court Case)',
        description: 'Google Fonts are being loaded directly from US servers, leaking user IP addresses without prior consent.',
        business_impact: 'High risk: This is a major trigger for Abmahnung (legal claims) in DACH regions.',
        potential_fine: 'Up to €250,000 per violation claim.',
        recommendation: 'ACTION: Self-host all fonts on your own server to prevent unauthorized data transfers to US servers.',
        country: tld === 'de' || tld === 'at' ? tld.toUpperCase() : 'EU'
      });
    }

    // --- NATIONAL COMPLIANCE CHECKS ---
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());

    // DE/AT: Impressum check
    if (tld === 'de' || tld === 'at' || pageText.includes('impressum')) {
      const deMarkers = ['handelsregister', 'registernummer', 'ihk', 'steuer-id', 'ust-idnr', 'amtsgericht'];
      if (!deMarkers.some(m => pageText.includes(m))) {
        finalFindings.push({
          issue_type: 'NATIONAL_DISCLOSURE_INCOMPLETE_DE',
          law_name: '§ 5 DDG (Germany)',
          description: 'Mandatory business registration details (VAT ID, Register Number) missing from the Impressum.',
          business_impact: 'Critical risk: Subject to competitor legal warnings (Abmahnung).',
          potential_fine: 'Up to €50,000.',
          recommendation: 'ACTION: Update Impressum with your registration number and VAT ID.',
          country: tld.toUpperCase()
        });
      }
    }

    // IT: P.IVA check
    if (tld === 'it') {
      const pIvaRegex = /p\.iva|partita iva|iva\s\d{11}/i;
      if (!pIvaRegex.test(pageText)) {
        finalFindings.push({
          issue_type: 'NATIONAL_DISCLOSURE_INCOMPLETE_IT',
          law_name: 'DPR 633/1972 (Italy)',
          description: 'Mandatory VAT ID (Partita IVA) not found in the homepage footer.',
          business_impact: 'Administrative non-compliance risk.',
          potential_fine: 'Administrative fines up to €10,000.',
          recommendation: 'ACTION: Add your 11-digit Partita IVA to the site footer.',
          country: 'IT'
        });
      }
    }

    // --- SAVE & DELIVER ---
    await pool.query("DELETE FROM public.site_violations WHERE domain = $1", [domainName]);
    for (const f of finalFindings) {
      await pool.query(
        `INSERT INTO public.site_violations (domain, issue_type, severity, description, law_name, recommendation, potential_fine, business_impact) 
         VALUES ($1, $2, 'high', $3, $4, $5, $6, $7)`,
        [domainName, f.issue_type, f.description, f.law_name, f.recommendation, f.potential_fine, f.business_impact]
      );
    }

    await pool.query("UPDATE public.scan_queue SET status = 'completed', violations_count = $1 WHERE id = $2", [finalFindings.length, taskId]);

    const pdfBuffer = await generatePdfReport(domainName, finalFindings);
    if (userEmail && pdfBuffer) {
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Statutory Audit Complete: ${domainName}`,
        text: `The EU statutory audit for ${domainName} is complete. Found ${finalFindings.length} violations.`,
        attachments: [{ filename: `Humango_Audit_${domainName}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      });
    }

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
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

startWorker();
