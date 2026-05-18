
import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * Professional PDF Report Generator
 * Features: Corporate Header, Unique findings, A4 Layout.
 */

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

interface Finding {
  issue_type?: string;
  category?: string;
  severity: string;
  description?: string;
  law_name?: string;
  recommendation?: string;
}

export async function generatePdfReport(domain: string, findings: Finding[] = []): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const safeDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    
    // Filter duplicates by type
    const uniqueFindingsMap = new Map();
    findings.forEach(f => {
      const type = f.issue_type || 'UNKNOWN_ISSUE';
      if (!uniqueFindingsMap.has(type)) {
        uniqueFindingsMap.set(type, f);
      }
    });
    
    const cleanFindings = Array.from(uniqueFindingsMap.values());
    const isCompliant = cleanFindings.length === 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 40px; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; margin: 0; padding: 0; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .logo-box { display: flex; align-items: center; gap: 10px; }
          .logo-text { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          .logo-text span { color: #3b82f6; }
          .company-details { text-align: right; font-size: 9px; color: #64748b; line-height: 1.4; }
          .report-meta { margin-bottom: 40px; }
          .report-title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
          .target-info { font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 500; }
          .finding-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; background: #ffffff; }
          .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .type-label { font-weight: 700; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; color: #0f172a; }
          .severity-badge { font-size: 9px; padding: 4px 10px; border-radius: 6px; font-weight: 800; letter-spacing: 0.05em; }
          .sev-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
          .sev-high { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
          .sev-medium { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }
          .desc-text { font-size: 12px; margin-bottom: 16px; color: #334155; }
          .law-ref { font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 16px; display: flex; align-items: center; gap: 5px; }
          .recommendation-box { background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 11px; border-left: 4px solid #3b82f6; color: #1e293b; }
          .compliant-hero { text-align: center; padding: 80px 40px; border: 2px dashed #10b981; border-radius: 24px; background: #f0fdf4; margin-top: 40px; }
          .compliant-icon { font-size: 48px; margin-bottom: 20px; color: #10b981; }
          .compliant-status { font-size: 24px; font-weight: 800; color: #065f46; margin-bottom: 12px; }
          .compliant-desc { color: #065f46; opacity: 0.8; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <div class="logo-text">Humango<span>Compliance</span></div>
          </div>
          <div class="company-details">
            <strong>Humango Limited</strong> | Co. No: 16750477<br>
            182-184 High Street North, London, E6 2JA<br>
            Contact: abuse@humango.app | RFC 9309 Audit Node
          </div>
        </div>

        <div class="report-meta">
          <h1 class="report-title">Statutory Audit Report</h1>
          <div class="target-info">Domain: <strong>${safeDomain}</strong> | Issued: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>

        ${isCompliant ? `
          <div class="compliant-hero">
            <div class="compliant-icon">✓</div>
            <div class="compliant-status">SYSTEM COMPLIANT</div>
            <p class="compliant-desc">No high-risk tracking behaviors, unauthorized data transmissions, or missing legal frameworks were detected during this statutory audit session.</p>
          </div>
        ` : cleanFindings.map(v => `
          <div class="finding-card">
            <div class="card-head">
              <span class="type-label">${(v.issue_type || 'Statutory Violation').replace(/_/g, ' ')}</span>
              <span class="severity-badge sev-${(v.severity || 'medium').toLowerCase()}">${(v.severity || 'MEDIUM').toUpperCase()}</span>
            </div>
            <div class="desc-text">${v.description}</div>
            <div class="law-ref">Legal Basis: ${v.law_name || 'GDPR Compliance Standards'}</div>
            <div class="recommendation-box">
              <strong>Recommended Action:</strong><br>
              ${v.recommendation}
            </div>
          </div>
        `).join('')}
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

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', bottom: '60px', left: '40px', right: '40px' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size: 9px; width: 100%; text-align: center; color: #94a3b8; font-family: Helvetica;">bot.humango.app | Statutory Compliance Verified | © 2026 Humango Limited</div>'
    });
  } catch (error) {
    console.error('[PDF Engine Error]', error);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
