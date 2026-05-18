
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
  const networkLogs: string[] = [];
  const findings: any[] = [];
  
  try {
    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // Включаем шпионаж за сетью
    await page.setRequestInterception(true);
    page.on('request', request => {
      networkLogs.push(request.url());
      request.continue();
    });

    let cleanUrl = domainUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    const urlObj = new URL(cleanUrl);
    const originUrl = urlObj.origin;
    const domainName = urlObj.hostname;

    console.log(`[Worker] Deep Auditing: ${originUrl}`);
    
    // 1. ПРОВЕРКА КУКИ И СЕТЕВЫХ ТРЕКЕРОВ ПРИ ЗАГРУЗКЕ
    await page.goto(originUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    const cookies = await page.cookies();
    const trackingCookieMarkers = ['_ga', '_gid', '_fbp', '_fr', 'ads', 'metrics', 'optimizely'];
    const activeTrackingCookies = cookies.filter(c => 
      trackingCookieMarkers.some(marker => c.name.toLowerCase().includes(marker))
    );

    if (activeTrackingCookies.length > 0) {
      findings.push({
        category: 'GDPR',
        issue_type: 'COOKIE_CONSENT_VIOLATION',
        severity: 'critical',
        description: 'Сайт автоматически устанавливает маркетинговые куки (Google/Facebook) до получения согласия пользователя.',
        law_name: 'Art. 6 & 7 GDPR',
        business_impact: 'Высокий риск штрафа за незаконную обработку данных без волеизъявления пользователя.',
        recommendation: 'Заблокируйте инициализацию аналитических скриптов до клика "Принять" на Cookie-баннере.'
      });
    }

    const hasGoogleAnalytics = networkLogs.some(url => url.includes('google-analytics.com') || url.includes('analytics.google'));
    const hasFacebookPixel = networkLogs.some(url => url.includes('connect.facebook.net') || url.includes('facebook.com/tr'));

    if (hasGoogleAnalytics || hasFacebookPixel) {
      findings.push({
        category: 'Privacy',
        issue_type: 'TRACKER_LEAK_WITHOUT_CONSENT',
        severity: 'critical',
        description: 'Обнаружена передача данных в рекламные сети (Google/Meta) сразу после загрузки страницы без согласия.',
        law_name: 'ePrivacy Directive & GDPR Art. 5',
        business_impact: 'Прямое нарушение конфиденциальности. Риск блокировки рекламных аккаунтов за несоблюдение политики согласия.',
        recommendation: 'Настройте Consent Mode v2 для Google и блокировку Pixel до фиксации согласия.'
      });
    }

    // 2. СБОР КОНТАКТОВ ДЛЯ CRM
    const extracted = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
      return {
        emails: Array.from(new Set(bodyText.match(emailRegex) || [])),
        phones: Array.from(new Set(bodyText.match(phoneRegex) || []))
      };
    });

    // 3. ПОИСК И АНАЛИЗ ПОЛИТИКИ
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.toLowerCase().trim() || ''
      }));
    });

    const legalKeywords = ['privacy', 'policy', 'legal', 'datenschutz', 'impressum', 'terms', 'confidentialite'];
    let foundTarget = links.find(link => 
      legalKeywords.some(keyword => (link.href || '').includes(keyword) || (link.text || '').includes(keyword))
    );

    let legalText = '';
    let foundUrl = originUrl;

    if (foundTarget) {
      await page.goto(foundTarget.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      legalText = await page.evaluate(() => document.body.innerText);
      foundUrl = foundTarget.href;
    }

    // 4. ПРОВЕРКА ФИНАНСОВЫХ ДАННЫХ И ХРАНЕНИЯ
    if (!legalText || legalText.trim().length < 400) {
      findings.push({
        category: 'GDPR',
        issue_type: 'MISSING_CORE_FRAMEWORK',
        severity: 'critical',
        description: 'На сайте отсутствуют обязательные юридические документы (Политика конфиденциальности / Impressum).',
        law_name: 'Art. 13 GDPR',
        business_impact: 'Критический риск. Несоответствие базовым требованиям ЕС/Великобритании.',
        recommendation: 'ACTION: Срочно внедрите юридический футер с ссылками на легальные документы.'
      });
    } else {
      const textLower = legalText.toLowerCase();
      
      // Сроки хранения
      const retentionRegex = /(storage|retention|store|keep|retain|period|months|years|days|24\s*months|3\s*years)/i;
      if (!retentionRegex.test(textLower)) {
        findings.push({
          category: 'Privacy',
          issue_type: 'DATA_RETENTION_MISSING',
          severity: 'high',
          description: 'В политике не указаны сроки хранения персональных данных.',
          law_name: 'Art. 13(2)(a) GDPR',
          business_impact: 'Нарушение принципа прозрачности обработки данных.',
          recommendation: 'Добавьте пункт: "Данные хранятся в течение 24 месяцев или до момента удаления аккаунта".'
        });
      }

      // Финансовая безопасность
      const financialKeywords = ['credit card', 'payment info', 'bank account', 'billing details', 'платежные данные', 'банковская карта'];
      const complianceKeywords = ['stripe', 'paypal', 'pci-dss', 'encrypted provider', 'шлюз', 'провайдер'];
      
      const hasFinancial = financialKeywords.some(kw => textLower.includes(kw));
      const hasCompliance = complianceKeywords.some(kw => textLower.includes(kw));

      if (hasFinancial && !hasCompliance) {
        findings.push({
          category: 'Security',
          issue_type: 'UNSECURED_FINANCIAL_DECLARATION',
          severity: 'high',
          description: 'Сайт декларирует сбор платежных данных, но не указывает использование защищенных PCI-DSS провайдеров.',
          law_name: 'Art. 32 GDPR (Security of processing)',
          business_impact: 'Риск признания обработки данных небезопасной. Уязвимость для исков при утечках.',
          recommendation: 'Укажите в политике, что платежи обрабатываются через Stripe/PayPal/Adyen в зашифрованном виде.'
        });
      }
    }

    // СОХРАНЕНИЕ РЕЗУЛЬТАТОВ
    for (const finding of findings) {
      await pool.query(
        `INSERT INTO public.site_violations (
          domain, url, page_url, category, issue_type, severity, description, law_name, recommendation, business_impact, report_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [domainName, originUrl, foundUrl, finding.category, finding.issue_type, finding.severity, finding.description, finding.law_name, finding.recommendation, finding.business_impact, 'SaaS']
      );
    }

    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', 
           violations_count = $1, 
           contacts = $2,
           crm_status = 'free'
       WHERE id = $3`,
      [findings.length, JSON.stringify(extracted), taskId]
    );

    // ОТПРАВКА PDF
    const pdfBuffer = await generatePdfReport(domainName, findings);
    if (userEmail && pdfBuffer) {
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Результат аудита соответствия для ${domainName}`,
        text: `Аудит для сайта ${domainName} завершен. Обнаружено нарушений: ${findings.length}. Подробный отчет во вложении.`,
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
  console.log("[Deep Audit Worker V38] Logic: Tracking + Security");
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
