
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
  port: parseInt(process.env.SMTP_PORT || '2525'),
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

async function executeDeterministicAudit(taskId: number, domainUrl: string, userEmail: string) {
  let browser: any = null;
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    let cleanUrl = domainUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const urlObj = new URL(cleanUrl);
    const originUrl = urlObj.origin;
    const domainName = urlObj.hostname;

    console.log(`[Worker] Auditing: ${originUrl}`);
    
    let legalText = '';
    let foundUrl = originUrl;
    let contacts = { emails: [] as string[], phones: [] as string[], other: [] as string[] };

    try {
      await page.goto(originUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Contact Extraction Logic
      const extracted = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
        
        return {
          emails: Array.from(new Set(bodyText.match(emailRegex) || [])),
          phones: Array.from(new Set(bodyText.match(phoneRegex) || []))
        };
      });
      contacts.emails = extracted.emails;
      contacts.phones = extracted.phones;

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.toLowerCase().trim() || ''
        }));
      });

      const legalKeywords = ['privacy', 'policy', 'legal', 'datenschutz', 'impressum', 'terms', 'confidentialite', 'privacy-policy'];
      let foundTarget = links.find(link => 
        legalKeywords.some(keyword => (link.href || '').includes(keyword) || (link.text || '').includes(keyword))
      );

      if (!foundTarget) {
        const fallbackUrl = new URL('/legal/privacy', originUrl).href;
        const res = await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (res && res.status() === 200) {
          legalText = await page.evaluate(() => document.body.innerText);
          foundUrl = fallbackUrl;
        }
      } else {
        await page.goto(foundTarget.href, { waitUntil: 'domcontentloaded', timeout: 35000 });
        legalText = await page.evaluate(() => document.body.innerText);
        foundUrl = foundTarget.href;
      }
    } catch (e: any) {
      console.warn(`[Worker] Navigation Warning: ${e.message}`);
    }

    let findings = [];

    // Audit logic...
    if (!legalText || legalText.trim().length < 400) {
      findings.push({
        category: 'GDPR',
        issue_type: 'MISSING_CORE_FRAMEWORK',
        severity: 'critical',
        description: 'No statutory legal disclosures identified.',
        law_name: 'Art. 13 GDPR',
        business_impact: 'High risk.',
        recommendation: 'ACTION: INSERT PRIVACY FOOTER.'
      });
    } else {
      const retentionRegex = /(storage|retention|store|keep|retain|period|months|years|days|24\s*months|3\s*years)/i;
      if (!retentionRegex.test(legalText)) {
        findings.push({
          category: 'Privacy',
          issue_type: 'DATA_RETENTION_MISSING',
          severity: 'high',
          description: 'Fail to state data retention periods.',
          law_name: 'Art. 13(2)(a) GDPR',
          business_impact: 'Transparency failure.',
          recommendation: 'ACTION: INSERT RETENTION CLAUSE.'
        });
      }
    }

    // Save Violations
    for (const finding of findings) {
      await pool.query(
        `INSERT INTO public.site_violations (
          domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [domainName, originUrl, foundUrl, finding.category, finding.issue_type, finding.severity, finding.description, finding.law_name, finding.recommendation, finding.business_impact, 'SaaS']
      );
    }

    // UPDATE QUEUE with CRM metadata
    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           contacts = $2,
           crm_status = 'free'
       WHERE id = $3`,
      [findings.length, JSON.stringify(contacts), taskId]
    );

    // Auditor Route: If no contacts found, mark for special audit
    if (contacts.emails.length === 0 && contacts.phones.length === 0) {
      await pool.query("UPDATE scan_queue SET status = 'to_auditor' WHERE id = $1", [taskId]);
    }

    const pdfBuffer = await generatePdfReport(domainName, findings);
    if (userEmail && pdfBuffer) {
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Audit Report for ${domainName}`,
        text: `Your audit for ${domainName} is complete.`,
        attachments: [{ filename: `Humango_Audit_${domainName}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      });
    }

  } catch (err: any) {
    console.error(`[Worker Fatal Error]`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close();
  }
}

async function startWorker() {
  console.log("==================================================");
  console.log("[CRM-Worker V37] Service active.");
  console.log("==================================================");
  
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
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (e: any) {
      console.error("[Worker Loop Error]", e.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

startWorker();
