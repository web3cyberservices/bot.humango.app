
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

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
    const DOMPurify = (await import('isomorphic-dompurify')).default;
    const safeDomain = DOMPurify.sanitize(domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0]);
    const otherDomain = safeDomain.startsWith('www.') ? safeDomain.replace('www.', '') : `www.${safeDomain}`;

    let findings = providedFindings || [];

    if (findings.length === 0) {
      const res = await pool.query(`
        SELECT issue_type, severity, description, law_name, recommendation 
        FROM site_violations 
        WHERE domain = $1 OR domain = $2
        ORDER BY created_at DESC
      `, [safeDomain, otherDomain]);
      findings = res.rows;
    }

    // Logical Filter: Prevent contradictions
    const hasMissingFramework = findings.some((f: any) => 
      f.issue_type?.toUpperCase().includes('MISSING CORE FRAMEWORK') || 
      f.type === 'MISSING_CORE_FRAMEWORK'
    );

    if (hasMissingFramework) {
      // If document is missing, clear hallucinated content findings
      findings = findings.filter((f: any) => 
        f.issue_type?.toUpperCase().includes('MISSING CORE FRAMEWORK') || 
        f.type === 'MISSING_CORE_FRAMEWORK'
      );
    }

    // Force double quotes in recommendations for consistency and UI cleanliness
    findings = findings.map((v: any) => ({
      ...v,
      recommendation: (v.recommendation || v.action || '').replace(/[']/g, '"')
    }));

    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
      }
    } catch (e) {}

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
          .logo-box { display: flex; align-items: center; gap: 10px; }
          .title-box { text-align: right; }
          .title-box div { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; background: #fff; }
          .severity-badge { font-size: 10px; font-weight: bold; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
          .severity-critical { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .severity-high { background: #fff7ed; color: #f97316; border: 1px solid #ffedd5; }
          .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          .recommendation-label { font-size: 9px; font-weight: bold; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px; }
          .recommendation-box { background: #f8fafc; padding: 15px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #334155; border: 1px border #f1f5f9; word-break: break-all; }
          h1 { font-size: 24px; margin-bottom: 10px; color: #0f172a; }
          .domain-sub { color: #64748b; font-size: 14px; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            ${logoBase64 ? `<img src="${logoBase64}" width="28">` : ''}
            <div style="font-size: 16px; font-weight: 800; letter-spacing: -0.5px;">Humango<span style="color:#3b82f6">Compliance</span></div>
          </div>
          <div class="title-box">
            <div>Audit ID: ${Math.random().toString(36).substring(7).toUpperCase()}</div>
            <div style="font-weight:bold; color:#0f172a">Statutory Report</div>
          </div>
        </div>

        <h1>Diagnostic Analysis</h1>
        <div class="domain-sub">Target Infrastructure: <strong>${safeDomain}</strong></div>

        ${findings.length === 0 ? `
          <div class="card" style="text-align:center; padding: 40px;">
            <div style="color: #10b981; font-size: 40px; margin-bottom: 15px;">✓</div>
            <h2 style="margin:0">No Statutory Violations Detected</h2>
            <p style="color:#64748b; font-size:14px">Your website meets the primary transparency requirements identified by our automated audit engine.</p>
          </div>
        ` : findings.map((v: any) => `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 15px;">
              <div style="font-size:16px; font-weight: 800; color: #0f172a;">${v.issue_type || v.type}</div>
              <span class="severity-badge ${v.severity?.toLowerCase() === 'critical' ? 'severity-critical' : 'severity-high'}">
                ${v.severity?.toUpperCase() || 'HIGH RISK'}
              </span>
            </div>
            <div style="font-size:13px; color:#475569; margin-bottom: 15px;">${v.description || v.summary}</div>
            <div style="font-size:10px; color:#94a3b8; margin-bottom: 15px;">LEGAL BASIS: ${v.law_name || v.basis || 'GDPR Art. 13'}</div>
            
            <div class="recommendation-label">Corrective Action Required:</div>
            <div class="recommendation-box">${v.recommendation || v.action}</div>
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
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    return await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
      displayHeaderFooter: true,
      footerTemplate: '<div style="font-size:10px; width:100%; text-align:center; color:#94a3b8;">bot.humango.app | Statutory Compliance Verified</div>',
      headerTemplate: '<div></div>'
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
