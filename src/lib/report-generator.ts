
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * Professional PDF Report Generator - Pan-European Standard v2026
 */

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/root/.cache/puppeteer/chrome/linux-132.0.6834.110/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

interface Finding {
  issue_type?: string;
  category?: string;
  severity: string;
  description?: string;
  law_name?: string;
  recommendation?: string;
  business_impact?: string;
  potential_fine?: string;
  country?: string;
}

export async function generatePdfReport(domain: string, findings: Finding[] = []): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const safeDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    
    // Filter duplicates by issue_type
    const uniqueMap = new Map();
    findings.forEach(f => {
      const key = f.issue_type || 'GENERAL_ISSUE';
      if (!uniqueMap.has(key)) uniqueMap.set(key, f);
    });
    const cleanFindings = Array.from(uniqueMap.values());
    const isCompliant = cleanFindings.length === 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 24px; margin-bottom: 40px; }
          .logo-box { display: flex; align-items: center; gap: 8px; }
          .logo-circle { width: 32px; height: 32px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 18px; }
          .logo-text { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.04em; }
          .logo-text span { color: #3b82f6; }
          
          .company-details { text-align: right; font-size: 10px; color: #64748b; line-height: 1.6; }
          .report-meta { margin-bottom: 40px; }
          .report-title { font-size: 34px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.04em; text-transform: uppercase; }
          .target-info { font-size: 14px; color: #64748b; margin-top: 12px; font-weight: 500; font-family: monospace; }
          
          .finding-card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; margin-bottom: 32px; page-break-inside: avoid; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
          .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
          .type-label { font-weight: 800; text-transform: uppercase; font-size: 14px; color: #0f172a; letter-spacing: 0.05em; }
          .severity-badge { font-size: 10px; padding: 6px 14px; border-radius: 9999px; font-weight: 800; text-transform: uppercase; }
          .sev-critical { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
          .sev-high { background: #ffedd5; color: #ea580c; border: 1px solid #fed7aa; }
          
          .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.1em; }
          .content-block { margin-bottom: 24px; }
          .desc-text { font-size: 14px; color: #334155; line-height: 1.6; }
          
          .liability-box { background: #fff1f2; padding: 20px; border-radius: 12px; border: 1px solid #fecaca; margin-bottom: 24px; }
          .liability-text { color: #be123c; font-size: 14px; font-weight: 800; }

          .recommendation-box { background: #f8fafc; padding: 24px; border-radius: 16px; font-size: 13px; border-left: 6px solid #3b82f6; color: #1e293b; }
          
          .compliant-hero { text-align: center; padding: 100px 40px; border: 4px dashed #10b981; border-radius: 40px; background: #f0fdf4; margin-top: 40px; }
          .compliant-status { font-size: 32px; font-weight: 900; color: #065f46; letter-spacing: -0.02em; }
          
          .footer-note { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <div class="logo-circle">H</div>
            <div class="logo-text">Humango<span>Compliance</span></div>
          </div>
          <div class="company-details">
            <strong>Operator: Humango Limited</strong> | Co. No: 16750477<br>
            Address: 182-184 High Street North, London, E6 2JA<br>
            Verification: abuse@humango.app | EU Statutory Audit Node
          </div>
        </div>

        <div class="report-meta">
          <h1 class="report-title">Statutory Audit Report</h1>
          <div class="target-info">AUDIT TARGET: <strong>${safeDomain.toUpperCase()}</strong> | DATE: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>

        ${isCompliant ? `
          <div class="compliant-hero">
            <div class="compliant-status">STATUTORY COMPLIANCE VERIFIED</div>
            <p style="color:#065f46; margin-top:20px; font-size: 16px; font-weight: 500;">Infrastructure audit complete. No critical statutory violations or unauthorized data transfers were identified.</p>
          </div>
        ` : cleanFindings.map(v => `
          <div class="finding-card">
            <div class="card-head">
              <span class="type-label">${(v.issue_type || 'Compliance Violation').replace(/_/g, ' ')}</span>
              <span class="severity-badge sev-${(v.severity || 'high').toLowerCase()}">${v.severity || 'High Risk'}</span>
            </div>
            
            <div class="content-block">
              <div class="section-title">Detection Summary [${v.country || 'EU'}]</div>
              <div class="desc-text">${v.description}</div>
            </div>

            <div class="content-block">
              <div class="section-title">Legal Foundation</div>
              <div class="desc-text" style="font-weight: 800; color: #0f172a;">${v.law_name || 'EU GDPR Framework'}</div>
            </div>

            ${v.potential_fine ? `
            <div class="liability-box">
              <div class="section-title" style="color: #be123c;">Potential Statutory Liability</div>
              <div class="liability-text">${v.potential_fine}</div>
            </div>
            ` : ''}

            <div class="recommendation-box">
              <div class="section-title" style="color: #3b82f6;">Required Remediation</div>
              <div style="font-weight: 700; font-size: 14px;">${v.recommendation}</div>
            </div>
          </div>
        `).join('')}

        <div class="footer-note">
          humango.app | Statutory Compliance Verified | © 2026 Humango Limited
        </div>
      </body>
      </html>
    `;

    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('[PDF Generation Error]', error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
