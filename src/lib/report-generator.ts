
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

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
    
    // Filter duplicates
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
        <style>
          @page { size: A4; margin: 40px; }
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; margin: 0; padding: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #0f172a; }
          .logo span { color: #3b82f6; }
          .company-info { text-align: right; font-size: 10px; color: #64748b; }
          .title-section { margin-bottom: 30px; }
          .title { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0; }
          .domain { font-size: 14px; color: #64748b; margin-top: 5px; }
          .finding-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
          .finding-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .finding-type { font-weight: bold; text-transform: uppercase; font-size: 14px; }
          .severity { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
          .severity-critical { background: #fee2e2; color: #ef4444; }
          .severity-high { background: #ffedd5; color: #f97316; }
          .description { font-size: 12px; margin-bottom: 10px; color: #475569; }
          .law { font-size: 11px; font-style: italic; color: #64748b; margin-bottom: 15px; }
          .action { background: #f8fafc; padding: 10px; border-radius: 4px; font-size: 11px; border-left: 3px solid #3b82f6; }
          .compliant-box { text-align: center; padding: 50px; border: 2px dashed #10b981; border-radius: 12px; background: #ecfdf5; }
          .compliant-title { font-size: 20px; font-weight: bold; color: #065f46; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Humango<span>Compliance</span></div>
          <div class="company-info">
            Humango Limited | Co. No: 16750477<br>
            182-184 High Street North, London, E6 2JA<br>
            Verification: abuse@humango.app
          </div>
        </div>

        <div class="title-section">
          <h1 class="title">Compliance Audit Report</h1>
          <div class="domain">Target: <strong>${safeDomain}</strong> | Date: ${new Date().toLocaleDateString()}</div>
        </div>

        ${isCompliant ? `
          <div class="compliant-box">
            <div class="compliant-title">STATUTORY COMPLIANCE VERIFIED</div>
            <p>No high-risk tracking behaviors or missing legal frameworks detected.</p>
          </div>
        ` : cleanFindings.map(v => `
          <div class="finding-card">
            <div class="finding-header">
              <span class="finding-type">${(v.issue_type || 'Violation').replace(/_/g, ' ')}</span>
              <span class="severity severity-${v.severity.toLowerCase()}">${v.severity.toUpperCase()}</span>
            </div>
            <div class="description">${v.description}</div>
            <div class="law">Legal Basis: ${v.law_name || 'GDPR Statutory Requirements'}</div>
            <div class="action"><strong>Recommendation:</strong> ${v.recommendation}</div>
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
      footerTemplate: '<div style="font-size: 9px; width: 100%; text-align: center; color: #94a3b8;">bot.humango.app | Statutory Compliance Verified | © 2026 Humango Limited</div>'
    });
  } catch (error) {
    console.error('[PDF Engine Error]', error);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
