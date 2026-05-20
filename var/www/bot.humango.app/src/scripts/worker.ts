'use server';

import { Pool } from 'pg';
import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
import { checkAndFeedQueue } from './autoSeeder';
import { generatePdfReport } from '../lib/report-generator';
import * as nodemailer from 'nodemailer';

dotenv.config();

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
  tls: { rejectUnauthorized: false }
});

const JURISDICTION_RULES: Record<string, any> = {
  'de': { lang: ['datenschutz', 'impressum'], requiredLinks: ['impressum'], prefix: 'DE_AT' },
  'at': { lang: ['datenschutz', 'impressum'], requiredLinks: ['impressum'], prefix: 'DE_AT' },
  'fr': { lang: ['confidentialité', 'mentions légales'], requiredLinks: ['mentions légales'], prefix: 'FR' },
  'es': { lang: ['privacidad', 'aviso legal'], requiredLinks: ['aviso legal'], prefix: 'ES' },
  'it': { lang: ['privacy', 'note legali'], requiredLinks: ['note legali'], prefix: 'IT' },
  'nl': { lang: ['privacybeleid', 'colofon'], requiredLinks: ['colofon'], prefix: 'NL' }
};

async function performAudit(page: puppeteer.Page, scanId: number, url: string, userEmail?: string) {
  const finalFindings: any[] = [];
  let extractedEmails: any[] = [];
  let hasUS_Trackers = false;
  let legalText = '';
  let leadScore = 0;

  try {
    const domain = new URL(url).hostname.toLowerCase();
    const tld = domain.split('.').pop() || 'com';
    const localRule = JURISDICTION_RULES[tld];

    // --- STEP 1: NETWORK INTERCEPTION ---
    await page.setRequestInterception(true);
    page.on('request', req => {
      const rUrl = req.url().toLowerCase();
      if (rUrl.includes('google-analytics') || rUrl.includes('facebook.com/tr') || rUrl.includes('doubleclick')) {
        hasUS_Trackers = true;
        if (!finalFindings.some(f => f.type === 'TRACKING_TRAFFIC_DETECTED')) {
          finalFindings.push({
            type: 'TRACKING_TRAFFIC_DETECTED',
            summary: 'Illegal pre-consent tracking detected.',
            liability: 'Up to €20,000,000 or 4% of turnover.',
            recommendation: 'ACTION: Implement strict prior-blocking CMP.'
          });
        }
      }
      req.continue();
    });

    if (!url.startsWith('https://')) {
      finalFindings.push({ type: 'UNSECURED_CONNECTION', summary: 'Non-HTTPS Protocol.', liability: 'Art. 32 GDPR violation.', recommendation: 'ACTION: Force SSL/TLS.' });
      leadScore += 30;
    }

    // Go to main page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // --- EXTRACT CONTACTS FROM MAIN PAGE FIRST ---
    const extractEmails = async (p: puppeteer.Page) => {
      return await p.evaluate(() => {
        const text = document.body.innerText;
        const eRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        return Array.from(new Set(text.match(eRegex) || []))
          .filter(e => !['sentry', 'google', 'facebook', 'example'].some(d => e.toLowerCase().includes(d)));
      });
    };
    const mainPageEmails = await extractEmails(page);
    extractedEmails.push(...mainPageEmails);

    // --- STEP 2: JURISDICTION DETECTION ---
    if (localRule) {
      const hasLegalLink = await page.evaluate((markers) => {
        return Array.from(document.querySelectorAll('a')).some(a => markers.some(m => a.innerText.toLowerCase().includes(m)));
      }, localRule.requiredLinks);

      if (!hasLegalLink) {
        finalFindings.push({
          type: `MISSING_LOCALIZED_DISCLOSURE_${localRule.prefix}`,
          summary: `Missing mandatory ${localRule.requiredLinks[0]} link.`,
          liability: 'Administrative fines apply.',
          recommendation: `ACTION: Create a legal notice page.`
        });
        leadScore += 50;
      }
    }

    // --- STEP 3: DOCUMENT VALIDATION ---
    const privacyLink = await page.evaluate(() => {
      const markers = ['privacy', 'datenschutz', 'confidentialité', 'privacidad', 'prywatności'];
      const found = Array.from(document.querySelectorAll('a')).find(a => markers.some(m => a.innerText.toLowerCase().includes(m)));
      return found ? found.href : null;
    });

    let targetLegalUrl = privacyLink || `${new URL(url).origin}/privacy`;
    try {
      await page.goto(targetLegalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const rawText = await page.evaluate(() => document.body.innerText);
      if (rawText.length > 200 && ['privacy', 'policy', 'datenschutz', 'personal data'].some(m => rawText.toLowerCase().includes(m))) {
        legalText = rawText.toLowerCase();
      }
      // Also grab emails from privacy page
      const privEmails = await extractEmails(page);
      extractedEmails.push(...privEmails);
    } catch (e) {}

    // Deduplicate emails
    extractedEmails = [...new Set(extractedEmails)].map(e => ({ value: e, context: "Scraped" }));

    if (!legalText) {
      finalFindings.push({ type: 'MISSING_CORE_FRAMEWORK', summary: 'Critical Transparency Failure.', liability: 'Maximum GDPR fine.', recommendation: 'ACTION: Create and link a /privacy page.' });
      leadScore += 100;
    } else {
      // --- STEP 4: SEMANTIC ANALYSIS ---
      if (!['legal basis', 'article 6', 'rechtsgrundlage', 'base légale'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_LEGAL_BASES', summary: 'No explicit legal basis declared.', liability: 'Art. 13(1)(c) violation.', recommendation: 'ACTION: Explicitly cite processing grounds.' });
      }
      if (/ip address(es)? (are|is) not personal/i.test(legalText)) {
        finalFindings.push({ type: 'MISCLASSIFIED_PERSONAL_DATA', summary: 'IP Address misclassification.', liability: 'High risk of litigation.', recommendation: 'ACTION: Correct IP data classification.' });
      }
      if (['as long as', 'indefinitely', 'unbestimmte zeit'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'VAGUE_RETENTION_PERIOD', summary: 'Vague data retention terms.', liability: 'Art. 5(1)(e) violation.', recommendation: 'ACTION: Define exact periods.' });
      }
    }

    // --- STEP 5: TRIAGE & UPDATE DB ---
    let crmStatus = 'compliant';
    if (finalFindings.length > 0) {
      crmStatus = (extractedEmails.length > 0) ? 'ready_for_sales' : 'needs_analyst';
    }

    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', crm_status = $1, violations_count = $2, 
           audit_findings = $3, extracted_emails = $4, priority = $5, updated_at = NOW()
       WHERE id = $6`,
      [crmStatus, finalFindings.length, JSON.stringify(finalFindings), JSON.stringify(extractedEmails), leadScore, scanId]
    );

    // --- STEP 6: SEND EMAIL (IF REQUESTED) ---
    if (userEmail && userEmail.length > 5) {
       try {
         const pdfBuffer = await generatePdfReport(domain, finalFindings);
         if (pdfBuffer) {
           await transporter.sendMail({
             from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
             to: userEmail,
             subject: `Statutory Audit Report: ${domain}`,
             text: `The automated audit for ${domain} is complete. Please find your report attached.`,
             attachments: [{ filename: `Audit_${domain}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
           });
           console.log(`[Worker] Email sent to ${userEmail}`);
         }
       } catch (emailErr: any) {
         console.error(`[Worker] Failed to generate PDF or send email for ${domain}:`, emailErr.message);
       }
    }

    console.log(`[Worker] Done: ${domain} -> ${crmStatus}`);
  } catch (err: any) {
    console.error(`[Worker Error] Task ${scanId} failed:`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed' WHERE id = $1", [scanId]);
  }
}

async function startWorker() {
  console.log('[Worker] Booting up...');
  // ADDED FIX: --disable-setuid-sandbox is critical for Linux/Hetzner!
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  
  while (true) {
    try {
      const seeded = await checkAndFeedQueue(pool);
      
      const res = await pool.query(
        "SELECT id, url, user_email FROM public.scan_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );

      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE public.scan_queue SET status = 'processing', updated_at = NOW() WHERE id = $1", [task.id]);
        
        const page = await browser.newPage();
        await performAudit(page, task.id, task.url, task.user_email);
        await page.close();
      } else {
        // If queue is empty AND we didn't just seed new items, sleep for 15 seconds to prevent infinite loop spam
        if (!seeded) {
          await new Promise(r => setTimeout(r, 15000));
        }
      }
    } catch (e: any) { 
      console.error('[Worker Fatal]', e.message); 
      await new Promise(r => setTimeout(r, 15000)); 
    }
  }
}

startWorker();