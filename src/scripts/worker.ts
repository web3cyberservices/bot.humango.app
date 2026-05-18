
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Use environment variables for DB connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Use App Password for Gmail
  },
  tls: {
    rejectUnauthorized: false
  }
});

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
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

async function generateLocalPdf(domain: string, findings: any[]) {
  let browser: any = null;
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; font-weight: 800; display: flex; justify-content: space-between; }
          .card { border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 20px; background: #fff; }
          .badge { background: #fef2f2; color: #ef4444; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .footer { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 9px; color: #94a3b8; }
          .rec-box { background: #f8fafc; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; margin-top: 10px; border: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <span>Humango<span style="color:#3b82f6">Compliance</span></span>
          <span style="font-size:10px; color:#64748b">STATUTORY AUDIT REPORT</span>
        </div>
        <h1>Audit Results for ${domain}</h1>
        ${findings.length === 0 ? '<div class="card" style="text-align:center"><h2 style="color:#10b981">STATUS: COMPLIANT</h2><p>No technical statutory violations were detected on the target infrastructure.</p></div>' : findings.map(f => `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-weight:bold">${f.type || f.issue_type}</div>
              <span class="badge">CRITICAL</span>
            </div>
            <p style="font-size:13px; color:#475569">${f.summary || f.description}</p>
            <div style="font-size:10px; color:#3b82f6; font-weight:bold; margin-top:15px; text-transform:uppercase">Recommended Action:</div>
            <div class="rec-box">${(f.action || f.recommendation || '').replace(/'/g, '"')}</div>
          </div>
        `).join('')}
        <div class="footer">bot.humango.app | Statutory Compliance Verified | ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    return await page.pdf({ format: 'A4', printBackground: true });
  } catch (e) {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function executeDeterministicAudit(domain: string, userEmail: string) {
  let browser: any = null;
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    let cleanUrl = domain.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const originUrl = new URL(cleanUrl).origin;

    console.log(`[Worker] Auditing: ${originUrl}`);
    
    let legalText = '';
    let hasFooterLink = false;

    try {
      await page.goto(originUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.toLowerCase().trim() || ''
        }));
      });

      const legalKeywords = ['privacy', 'policy', 'legal', 'datenschutz', 'impressum', 'terms', 'confidentialite'];
      let foundTarget = links.find(link => 
        legalKeywords.some(keyword => link.href.includes(keyword) || link.text.includes(keyword))
      );

      if (!foundTarget) {
        console.log(`[Worker] Semantic search failed. Trying fallback paths...`);
        const fallbackUrl = new URL('/legal/privacy', originUrl).href;
        const res = await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (res && res.status() === 200) {
          legalText = await page.evaluate(() => document.body.innerText);
          hasFooterLink = true;
        }
      } else {
        hasFooterLink = true;
        await page.goto(foundTarget.href, { waitUntil: 'domcontentloaded', timeout: 35000 });
        legalText = await page.evaluate(() => document.body.innerText);
      }
    } catch (e: any) {
      console.warn(`[Worker] Crawl Warning: ${e.message}`);
    }

    let findings = [];
    if (!legalText || legalText.trim().length < 250) {
      findings.push({
        type: 'MISSING_CORE_FRAMEWORK',
        summary: 'No statutory legal disclosures (Privacy Policy/Impressum) were identified in the site architecture. This violates transparency standards under Art. 12 & 13 GDPR.',
        action: 'Add a "Privacy Policy" link to your website footer and provide the mandatory legal disclosures.'
      });
    } else {
      const retentionRegex = /(storage|retention|store|keep|retain|hold|period|months|years|days|24\s*months|3\s*years|\d+\s*(month|year|day|месяц|год|лет|дня|продолжительно))/i;
      const hasRetentionMention = retentionRegex.test(legalText);

      if (!hasRetentionMention) {
        findings.push({
          type: 'DATA_RETENTION_TIMEFRAMES',
          summary: 'The policy fails to state specific data retention periods as required by Art. 13 GDPR. Users must be informed about how long their data is stored.',
          action: 'Insert text: "Personal data is stored for 24 months from the last interaction or until account deletion is requested."'
        });
      }
    }

    const pdfBuffer = await generateLocalPdf(originUrl, findings);

    if (userEmail && pdfBuffer) {
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Statutory Compliance Audit Report for ${domain}`,
        text: `Hello,\n\nYour automated statutory compliance audit for ${domain} is complete. Please find the detailed PDF report attached.\n\nBest regards,\nHumango Team`,
        attachments: [{ filename: `Humango_Audit_${domain.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      });
    }

    await pool.query("UPDATE public.scan_queue SET status = 'completed' WHERE url = $1", [domain]);

  } catch (err: any) {
    console.error(`[Worker Fatal Error]`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE url = $1", [domain]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  console.log("==================================================");
  console.log("[Deterministic Worker] Service started successfully.");
  console.log("[Status] Monitoring scan_queue for pending tasks...");
  console.log("==================================================");
  
  while (true) {
    try {
      const res = await pool.query(
        "SELECT id, url, user_email FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );

      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        await executeDeterministicAudit(task.url, task.user_email);
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (e: any) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

startWorker();
