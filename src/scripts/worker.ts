
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
  const networkUrls: string[] = [];
  const finalFindings: any[] = [];
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // 1. Шпионаж за сетью (Network Interception)
    await page.setRequestInterception(true);
    page.on('request', request => {
      networkUrls.push(request.url().toLowerCase());
      request.continue();
    });

    let cleanUrl = domainUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const urlObj = new URL(cleanUrl);
    const originUrl = urlObj.origin;
    const domainName = urlObj.hostname;

    console.log(`[Compliance Engine] Auditing: ${originUrl}`);
    
    // 2. Загрузка без кликов по баннерам (No Interaction Policy)
    await page.goto(originUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // 3. ПРОВЕРКА ТРЕКЕРОВ (Network Sniffing)
    const hasGoogleAnalytics = networkUrls.some(url => url.includes('google-analytics.com') || url.includes('analytics.google'));
    const hasFacebookPixel = networkUrls.some(url => url.includes('connect.facebook.net') || url.includes('facebook.com/tr'));

    if (hasGoogleAnalytics || hasFacebookPixel) {
      finalFindings.push({
        category: 'Privacy',
        issue_type: 'TRACKING_TRAFFIC_DETECTED',
        severity: 'critical',
        description: 'Marketing tracking traffic (Google Analytics or Meta Pixel) was detected firing immediately upon page load without prior user consent.',
        law_name: 'Art. 6 & Art. 7 GDPR',
        business_impact: 'Critical risk of heavy regulatory fines. European authorities strictly forbid firing advertising or analytical scripts before the user explicitly clicks "Accept" on a cookie banner.',
        recommendation: 'ACTION: Configure your tag manager or cookie consent plug-in to block the initialization of Google Analytics and Meta Pixel scripts until the user fires a valid consent event.'
      });
    }

    // 4. ПРОВЕРКА GOOGLE FONTS (Munich Court Compliance)
    const hasGoogleFontsDirect = networkUrls.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'));
    if (hasGoogleFontsDirect) {
      finalFindings.push({
        category: 'Privacy',
        issue_type: 'GOOGLE_FONTS_PRIVACY_VIOLATION',
        severity: 'high',
        description: 'The website loads Google Fonts directly from Google servers in the USA, transmitting user IP addresses without consent.',
        law_name: 'Art. 6(1)(a) GDPR & Munich Regional Court Ruling',
        business_impact: 'High risk of litigation in Germany (Abmahnung). IP addresses are considered personal data and cannot be sent to US servers without prior consent.',
        recommendation: 'ACTION: Download fonts locally to your server and serve them via @font-face from your project folder to prevent external data transmission.'
      });
    }

    // 5. ПРОВЕРКА КУКИ (Cookie Inspection)
    const activeCookies = await page.cookies();
    const trackingMarkers = ['_ga', '_gid', '_fbp', '_fr', 'ads', 'metrics'];
    const illegalCookies = activeCookies.filter(c => trackingMarkers.some(m => c.name.toLowerCase().includes(m)));

    if (illegalCookies.length > 0) {
      finalFindings.push({
        category: 'Privacy',
        issue_type: 'COOKIE_CONSENT_VIOLATION',
        severity: 'critical',
        description: `The website placed ${illegalCookies.length} non-essential tracking/marketing cookies into the user's browser storage prior to any explicit interaction with the consent banner.`,
        law_name: 'ePrivacy Directive & Art. 7 GDPR',
        business_impact: 'Direct non-compliance with the Planet49 EU court ruling. High vulnerability during routine data protection audits.',
        recommendation: 'ACTION: Implement a hard-blocking cookie mechanism. All analytical and tracking cookies must be withheld from the browser storage until affirmative consent is given.'
      });
    }

    // 6. СБОР КОНТАКТОВ ДЛЯ CRM
    const extracted = await page.evaluate(() => {
      const text = document.body.innerText;
      const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const phones = text.match(/(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g) || [];
      return { emails: [...new Set(emails)], phones: [...new Set(phones)] };
    });

    // 7. ПОИСК ЛЕГАЛЬНЫХ ССЫЛОК И ТЕКСТА
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.textContent?.toLowerCase().trim() || ''
      }));
    });

    const findLink = (keys: string[]) => links.find(l => keys.some(k => (l.href || '').includes(k) || (l.text || '').includes(k)));
    const privacyLink = findLink(['privacy', 'datenschutz', 'policy']);
    const impressumLink = findLink(['impressum', 'legal-notice', 'site-notice']);

    let legalText = '';
    if (privacyLink) {
      try {
        await page.goto(privacyLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        legalText = await page.evaluate(() => document.body.innerText);
      } catch (e) {}
    }

    // 8. ПРОВЕРКА IMPRESSUM (§ 5 DDG)
    if (domainName.endsWith('.de') || impressumLink) {
      const impressumKeywords = ['handelsregister', 'registernummer', 'ihk', 'steuer-identifikationsnummer', 'vst-id'];
      const hasGermanCompliance = impressumKeywords.some(kw => legalText.toLowerCase().includes(kw));

      if (domainName.endsWith('.de') && !hasGermanCompliance) {
        finalFindings.push({
          category: 'Legal',
          issue_type: 'GERMAN_IMPRESSUM_INCOMPLETE',
          severity: 'high',
          description: 'The Impressum appears to be missing mandatory German regulatory details (Handelsregister or VAT ID).',
          law_name: '§ 5 DDG (Digitale-Dienste-Gesetz)',
          business_impact: 'High risk of "Abmahnung" (legal warnings) from competitors or specialized law firms in Germany.',
          recommendation: 'ACTION: Add your official registration details, VAT ID (USt-IdNr), and the responsible regulatory authority (IHK) to your legal notice.'
        });
      }
    }

    // 9. СОХРАНЕНИЕ И ЗАВЕРШЕНИЕ
    await pool.query("DELETE FROM public.site_violations WHERE domain = $1", [domainName]);
    for (const f of finalFindings) {
      await pool.query(
        `INSERT INTO public.site_violations (
          domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [domainName, originUrl, cleanUrl, f.category, f.issue_type, f.severity, f.description, f.law_name, f.recommendation, f.business_impact, 'SaaS']
      );
    }

    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           contacts = $2,
           crm_status = 'free'
       WHERE id = $3`,
      [finalFindings.length, JSON.stringify(extracted), taskId]
    );

    // 10. ГЕНЕРАЦИЯ PDF И ОТПРАВКА
    const pdfBuffer = await generatePdfReport(domainName, finalFindings);
    if (userEmail && pdfBuffer) {
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Statutory Audit Complete: ${domainName}`,
        text: `The automated compliance audit for ${domainName} is complete. Total violations identified: ${finalFindings.length}.\n\nPlease find your detailed PDF report attached.`,
        attachments: [{ 
          filename: `Humango_Audit_${domainName}.pdf`, 
          content: pdfBuffer, 
          contentType: 'application/pdf' 
        }]
      });
    }

  } catch (err: any) {
    console.error(`[Worker Error] ${domainUrl}:`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE id = $1", [taskId]);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function startWorker() {
  console.log("==================================================");
  console.log("   HUMANGO CRM : COMPLIANCE AUDIT ENGINE          ");
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
      console.error("[Loop Error]", e.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

startWorker();
