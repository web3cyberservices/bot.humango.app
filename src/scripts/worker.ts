
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
  'de': { name: 'Germany', requiredLinks: ['impressum'], tokens: ['handelsregister', 'ust-idnr'], code: 'DE' },
  'at': { name: 'Austria', requiredLinks: ['impressum'], tokens: ['firmenbuch', 'uid-nummer'], code: 'AT' },
  'fr': { name: 'France', requiredLinks: ['mentions légales'], tokens: ['siret', 'r.c.s'], code: 'FR' },
  'es': { name: 'Spain', requiredLinks: ['aviso legal'], tokens: ['cif', 'nif'], code: 'ES' },
  'it': { name: 'Italy', requiredLinks: ['note legali'], tokens: ['partita iva'], code: 'IT' }
};

async function performAudit(page: puppeteer.Page, scanId: number, url: string, userEmail?: string) {
  const finalFindings: any[] = [];
  let extractedEmails: any[] = [];
  let extractedPhones: any[] = [];
  let hasUS_Trackers = false;
  let legalText = '';
  let priorityScore = 0;

  try {
    const domain = new URL(url).hostname.toLowerCase();
    const tld = domain.split('.').pop() || 'com';
    const localRule = JURISDICTION_RULES[tld];

    // 1. NETWORK & COOKIES
    await page.setRequestInterception(true);
    page.on('request', req => {
      const rUrl = req.url().toLowerCase();
      if (rUrl.includes('google-analytics') || rUrl.includes('facebook.com/tr') || rUrl.includes('doubleclick')) {
        hasUS_Trackers = true;
        if (!finalFindings.some(f => f.type === 'TRACKING_TRAFFIC_DETECTED')) {
          finalFindings.push({ type: 'TRACKING_TRAFFIC_DETECTED', summary: 'Illegal pre-consent tracking.', liability: 'Up to €20M or 4% turnover.', recommendation: 'ACTION: Implement prior-blocking CMP.' });
        }
      }
      req.continue();
    });

    if (!url.startsWith('https://')) {
      finalFindings.push({ type: 'UNSECURED_CONNECTION', summary: 'Non-HTTPS Protocol.', liability: 'Art. 32 GDPR violation.', recommendation: 'ACTION: Force SSL/TLS.' });
      priorityScore += 30;
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    // 2. JURISDICTION DETECTION
    if (localRule) {
      const hasLegalLink = await page.evaluate((markers) => {
        return Array.from(document.querySelectorAll('a')).some(a => markers.some(m => a.innerText.toLowerCase().includes(m)));
      }, localRule.requiredLinks);

      if (!hasLegalLink) {
        finalFindings.push({ type: `MISSING_LOCALIZED_DISCLOSURE_${localRule.code}`, summary: `Missing mandatory ${localRule.requiredLinks[0]} link.`, liability: 'Fines up to €50,000.', recommendation: `ACTION: Create a /legal page.` });
        priorityScore += 50;
      }
    }

    // 3. STRICT DOCUMENT VALIDATION
    const privacyLink = await page.evaluate(() => {
      const markers = ['privacy', 'datenschutz', 'confidentialité', 'privacidad', 'prywatности'];
      const found = Array.from(document.querySelectorAll('a')).find(a => markers.some(m => a.innerText.toLowerCase().includes(m)));
      return found ? found.href : null;
    });

    let targetLegalUrl = privacyLink || `${new URL(url).origin}/privacy`;
    try {
      await page.goto(targetLegalUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      const rawText = await page.evaluate(() => document.body.innerText);
      if (rawText.length > 200 && ['privacy', 'policy', 'datenschutz'].some(m => rawText.toLowerCase().includes(m))) {
        legalText = rawText.toLowerCase();
      }
    } catch (e) {}

    if (!legalText) {
      finalFindings.push({ type: 'MISSING_CORE_FRAMEWORK', summary: 'Critical Transparency Failure.', liability: 'Maximum GDPR fine risk.', recommendation: 'ACTION: Create and link a /privacy page.' });
      priorityScore += 100;
    } else {
      // 4. DEEP SEMANTIC ANALYSIS
      if (!['legal basis', 'article 6', 'rechtsgrundlage'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_LEGAL_BASES', summary: 'No explicit legal basis declared.', liability: 'Art. 13 violation.', recommendation: 'ACTION: List legal grounds (Art. 6).' });
      }
      if (/ip address(es)? (are|is) not personal/i.test(legalText)) {
        finalFindings.push({ type: 'MISCLASSIFIED_PERSONAL_DATA', summary: 'Incorrect IP data classification.', liability: 'High litigation risk.', recommendation: 'ACTION: Correct IP classification.' });
      }
      if (['as long as', 'indefinitely', 'unbestimmte zeit'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'VAGUE_RETENTION_PERIOD', summary: 'Vague data retention terms.', liability: 'Art. 5(1)(e) violation.', recommendation: 'ACTION: Specify exact periods.' });
      }
      if (!['dpo', 'data protection officer', 'datenschutzbeauftragter'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_DPO_DETAILS', summary: 'No DPO details found.', liability: 'Art. 13(1)(b) violation.', recommendation: 'ACTION: Declare DPO contact.' });
      }
      if (hasUS_Trackers && !['standard contractual clauses', 'scc', 'standardvertragsklauseln'].some(kw => legalText.includes(kw))) {
        finalFindings.push({ type: 'MISSING_INTERNATIONAL_TRANSFERS', summary: 'Undeclared US data transfers.', liability: 'Schrems II violation.', recommendation: 'ACTION: Include SCC clauses.' });
      }
    }

    // 5. CONTACT SCRAPING
    const extract = async (p: puppeteer.Page) => {
      return await p.evaluate(() => {
        const text = document.body.innerText;
        const eRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/g;
        const pRegex = /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g;
        
        const getCtx = (t: string, m: string) => {
          const i = t.indexOf(m);
          return t.substring(Math.max(0, i-150), Math.min(t.length, i+m.length+150)).replace(/\s+/g, ' ').trim();
        };

        const emails = Array.from(new Set(text.match(eRegex) || []))
          .filter(e => !['sentry', 'google', 'facebook'].some(d => e.toLowerCase().includes(d)))
          .map(e => ({ value: e, context: getCtx(text, e) }));
          
        const phones = Array.from(new Set(text.match(pRegex) || []))
          .filter(ph => ph.length > 8)
          .map(ph => ({ value: ph, context: getCtx(text, ph) }));

        return { emails, phones };
      });
    };

    const homeContacts = await extract(page);
    extractedEmails = homeContacts.emails;
    extractedPhones = homeContacts.phones;

    // 6. TRIAGE & DB UPDATE
    let crmStatus = 'compliant';
    if (finalFindings.length > 0) {
      crmStatus = (extractedEmails.length > 0) ? 'ready_for_sales' : 'needs_analyst';
    }

    await pool.query(
      `UPDATE public.scan_queue 
       SET status = 'completed', crm_status = $1, violations_count = $2, 
           audit_findings = $3, extracted_emails = $4, extracted_phones = $5, 
           priority = $6, updated_at = NOW()
       WHERE id = $7`,
      [crmStatus, finalFindings.length, JSON.stringify(finalFindings), JSON.stringify(extractedEmails), JSON.stringify(extractedPhones), priorityScore, scanId]
    );

    if (userEmail && userEmail.length > 5) {
       const pdfBuffer = await generatePdfReport(domain, finalFindings);
       if (pdfBuffer) {
         await transporter.sendMail({
           from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
           to: userEmail,
           subject: `Statutory Audit Report: ${domain}`,
           text: `Audit for ${domain} is complete.`,
           attachments: [{ filename: `Audit_${domain}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
         });
       }
    }
    console.log(`[Worker] Done: ${domain} -> ${crmStatus}`);
  } catch (err: any) {
    console.error(`[Worker Error] Task ${scanId} failed:`, err.message);
    await pool.query("UPDATE public.scan_queue SET status = 'failed', crm_status = 'lost' WHERE id = $1", [scanId]);
  }
}

async function startWorker() {
  console.log('[Worker] Booting up...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  
  while (true) {
    try {
      const res = await pool.query(
        "SELECT id, url, user_email FROM public.scan_queue WHERE crm_status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      );

      if (res.rows.length > 0) {
        const task = res.rows[0];
        await pool.query("UPDATE public.scan_queue SET status = 'processing' WHERE id = $1", [task.id]);
        const page = await browser.newPage();
        await performAudit(page, task.id, task.url, task.user_email);
        await page.close();
      } else {
        console.log('[Worker] No tasks. Checking seeder...');
        const seeded = await checkAndFeedQueue(pool);
        if (!seeded) {
          console.log('[Worker] No new targets found. Sleeping 15s...');
          await new Promise(r => setTimeout(r, 15000));
        }
      }
    } catch (e: any) { 
      console.error('[Worker Loop Error]', e.message); 
      await new Promise(r => setTimeout(r, 10000)); 
    }
  }
}

startWorker();
