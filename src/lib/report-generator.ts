
import { pool } from './db';
import puppeteer from 'puppeteer';
import fs from 'fs';

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export async function generatePdfReport(domain: string, providedFindings?: any[]): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const safeDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/[^a-z0-9.]/gi, '');
    
    let findings = providedFindings || [];

    if (findings.length === 0 && !providedFindings) {
      const res = await pool.query(`
        SELECT issue_type, severity, description, law_name, recommendation 
        FROM site_violations 
        WHERE domain = $1 
        ORDER BY created_at DESC
      `, [safeDomain]);
      findings = res.rows;
    }

    // Logic: If core framework is missing, filter out other secondary issues
    if (findings.some((f: any) => (f.type || f.issue_type || '').toUpperCase().includes('MISSING_CORE_FRAMEWORK'))) {
      findings = findings.filter((f: any) => (f.type || f.issue_type || '').toUpperCase().includes('MISSING_CORE_FRAMEWORK'));
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; background: #fff; }
          .severity-badge { font-size: 10px; font-weight: bold; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          .recommendation-box { background: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 11px; color: #334155; border: 1px solid #f1f5f9; word-break: break-all; }
          .compliant-box { text-align: center; padding: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 16px; font-weight: 800;">Humango<span style="color:#3b82f6">Compliance</span></div>
          <div style="text-align:right; font-size:10px; color:#64748b">STATUTORY AUDIT REPORT</div>
        </div>

        <h1>Diagnostic Analysis</h1>
        <p>Target Infrastructure: <strong>${safeDomain}</strong></p>

        ${findings.length === 0 ? `
          <div class="card compliant-box">
            <h2 style="color: #10b981;">STATUS: COMPLIANT</h2>
            <p>The audit engine found no technical statutory violations on the target domain.</p>
          </div>
        ` : findings.map((v: any) => `
          <div class="card">
            <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
              <div style="font-weight:bold;">${v.type || v.issue_type}</div>
              <span class="severity-badge">CRITICAL</span>
            </div>
            <p style="font-size:13px;">${v.summary || v.description}</p>
            <div style="font-size:10px; font-weight:bold; color:#3b82f6; margin-bottom:5px; text-transform:uppercase">Recommended Action:</div>
            <div class="recommendation-box">${(v.action || v.recommendation || '').replace(/'/g, '"')}</div>
          </div>
        `).join('')}

        <div class="footer">
          bot.humango.app | Statutory Compliance Verified | Generated on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
    browser = await puppeteer.launch({ 
      executablePath: executablePath || undefined, 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    return await page.pdf({ format: 'A4', printBackground: true });
  } catch (error) {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
