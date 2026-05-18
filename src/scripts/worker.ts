
import 'dotenv/config';
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import { chromium } from 'playwright';
import { generatePdfReport } from '../lib/report-generator';
import { saveAuditResults, saveBotEvent, testConnection, getBotStatus, getNextQueueItem, updateQueueStatus, normalizeUrl } from '../lib/db';
import settings from '../config/crawler-settings.json';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeDeterministicAudit(taskId: number, url: string, userEmail: string, workerId: number) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent: settings.userAgent
  });
  const page = await context.newPage();

  let cleanUrl = url.trim().toLowerCase();
  if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
  const originUrl = new URL(cleanUrl).origin;
  const domain = new URL(cleanUrl).hostname;

  let finalFindings: any[] = [];
  let legalText = '';
  let hasFooterLink = false;

  try {
    console.log(`[Worker ${workerId}] Deterministic Scan Start: ${originUrl}`);
    await saveBotEvent('START', `Compliance Scan [Worker ${workerId}]: ${domain}`);

    // 1. Scan Homepage
    await page.goto(originUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.toLowerCase().trim() || ''
      }));
    });

    const legalKeywords = ['privacy', 'policy', 'legal', 'datenschutz', 'impressum', 'terms', 'confidentialite', 'privacy-policy', 'legal-notice'];
    let foundTarget = links.find(link => 
      legalKeywords.some(keyword => link.href.includes(keyword) || link.text.includes(keyword))
    );

    // 2. Fallback: Check explicit path if auto-discovery fails
    if (!foundTarget) {
      try {
        const fallbackUrl = normalizeUrl('/legal/privacy', originUrl);
        console.log(`[Worker ${workerId}] Auto-discovery failed. Trying fallback: ${fallbackUrl}`);
        const testRes = await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (testRes && testRes.status() === 200) {
          legalText = await page.evaluate(() => document.body.innerText);
          hasFooterLink = true;
          console.log(`[Worker ${workerId}] Fallback success: Text retrieved from /legal/privacy`);
        }
      } catch (e) {
        console.log(`[Worker ${workerId}] Fallback URL unreachable.`);
      }
    } else {
      hasFooterLink = true;
      console.log(`[Worker ${workerId}] Navigating to discovered legal page: ${foundTarget.href}`);
      await page.goto(foundTarget.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      legalText = await page.evaluate(() => document.body.innerText);
    }

    // ==========================================
    // DETERMINISTIC AUDIT LOGIC (NO AI)
    // ==========================================

    // CHECK 1: Presence of Legal Framework
    if (!legalText || legalText.trim().length < 250) {
      console.log(`[Worker ${workerId}] Violation: Missing Core Framework.`);
      finalFindings.push({
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'MISSING CORE FRAMEWORK',
        severity: 'critical',
        evidence_html: originUrl,
        description: 'No statutory legal disclosure links or content (Privacy Policy/Impressum) were identified in the site architecture.',
        business_impact: 'Critical risk: Meta and Google advertising accounts may be suspended due to missing compliance signals.',
        law_name: 'Art. 12 & 13 GDPR',
        potential_fine: 'Up to €20,000,000 or 4% of global turnover.',
        explanation: 'The law requires a visible and accessible privacy policy on all commercial websites.',
        recommendation: 'ACTION: INSERT THIS HTML -> "<footer class=\\"legal-footer\\"><a href=\\"/privacy\\">Privacy Policy</a></footer>"',
        confidence_score: 1.0,
        verification_status: 'verified'
      });
    } else {
      console.log(`[Worker ${workerId}] Content found. Running Regex audit...`);

      // CHECK 2: Data Retention Mention
      // Keywords for storage periods across EN, DE, RU, FR, ES
      const retentionRegex = /(storage|retention|store|keep|retain|hold|period|months|years|days|\d+\s*(month|year|day|месяц|год|лет|дня|продолжительно|conservation|durée|délai|conservación|almacenamiento|plazo))/i;
      const hasRetentionMention = retentionRegex.test(legalText);

      if (!hasRetentionMention) {
        console.log(`[Worker ${workerId}] Violation: Missing Data Retention Timeframes.`);
        finalFindings.push({
          category: 'Privacy',
          report_type: 'SaaS',
          issue_type: 'DATA_RETENTION_TIMEFRAMES',
          severity: 'high',
          evidence_html: originUrl,
          description: 'Your privacy policy fails to state specific data retention periods.',
          business_impact: 'High risk of regulatory fines and Art. 17 GDPR erasure lawsuits.',
          law_name: 'Art. 13(2)(a) GDPR',
          potential_fine: 'Up to €20,000,000 or 4% of global turnover.',
          explanation: 'Mandatory transparency requires informing users exactly how long their data will be stored.',
          recommendation: 'ACTION: INSERT THIS TEXT -> "Data Retention: We store your personal data for a period of 24 months from your last interaction or until account deletion is requested."',
          confidence_score: 1.0,
          verification_status: 'verified'
        });
      }
    }

    // 3. Save findings to DB
    await saveAuditResults(domain, originUrl, finalFindings, 'basic');

    // 4. Generate PDF
    const pdfBuffer = await generatePdfReport(domain, finalFindings);

    // 5. Send Email
    if (userEmail && pdfBuffer) {
      console.log(`[Worker ${workerId}] Sending report to ${userEmail}...`);
      await transporter.sendMail({
        from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Statutory Compliance Audit Report for ${domain}`,
        text: `Hello,\n\nYour automated statutory compliance audit for ${domain} is complete. Please find the detailed PDF report attached.\n\nBest regards,\nHumango Team`,
        attachments: [{ 
          filename: `Humango_Audit_${domain}.pdf`, 
          content: pdfBuffer, 
          contentType: 'application/pdf' 
        }]
      });
      console.log(`[Worker ${workerId}] Email delivered.`);
    }

    // 6. Update Status
    await updateQueueStatus(taskId, 'completed');
    await saveBotEvent('SUCCESS', `Audit completed for ${domain}`);

  } catch (error: any) {
    console.error(`[Worker ${workerId}] Audit Crash:`, error.message);
    await updateQueueStatus(taskId, 'failed');
    await saveBotEvent('ERROR', `Audit failed for ${domain}: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function runWorker(workerId: number) {
  console.log(`[Worker ${workerId}] Priority Deterministic Engine Active.`);
  
  while (true) {
    try {
      const active = await getBotStatus();
      if (!active) {
        await sleep(5000);
        continue;
      }

      const task = await getNextQueueItem();
      if (!task) {
        await sleep(15000); 
        continue;
      }

      await executeDeterministicAudit(task.id, task.url, task.user_email, workerId);

    } catch (error: any) {
      console.error(`[Worker ${workerId}] Loop Error: ${error.message}`);
      await sleep(10000);
    }
    await sleep(1000);
  }
}

async function bootstrap() {
  console.log('==================================================');
  console.log('   HUMANGO DETERMINISTIC WORKER v2.0              ');
  console.log('   Status: Bootstraping...                        ');
  console.log('==================================================');
  
  try {
    await testConnection();
    
    transporter.verify((error) => {
      if (error) {
        console.error(`[SMTP] Verification failed: ${error.message}`);
      } else {
        console.log(`[SMTP] Server connected for ${process.env.SMTP_USER}`);
      }
    });

    const concurrency = settings.maxConcurrency || 5;
    console.log(`[System] Launching ${concurrency} parallel workers...`);
    
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker(i + 1));
    }
    await Promise.all(workers);

  } catch (error: any) {
    console.error('[Worker] CRITICAL UNHANDLED ERROR:', error.stack || error);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

bootstrap();
