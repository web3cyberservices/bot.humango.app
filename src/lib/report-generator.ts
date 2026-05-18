
import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * Professional PDF Report Generator - Standardized for Web & Email
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
  business_impact?: string;
  potential_fine?: string;
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
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Helvetica', 'Arial', sans-serif; 
            color: #1e293b; 
            margin: 0; 
            padding: 40px; 
            line-height: 1.5;
            background: #fff;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            border-bottom: 2px solid #3b82f6; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-circle {
            width: 40px;
            height: 40px;
            background: #3b82f6;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
          }
          .logo-text { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          .logo-text span { color: #3b82f6; }
          .company-details { text-align: right; font-size: 10px; color: #64748b; line-height: 1.5; }
          
          .report-meta { margin-bottom: 40px; }
          .report-title { font-size: 34px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
          .target-info { font-size: 14px; color: #64748b; margin-top: 10px; font-weight: 500; }
          
          .finding-card { 
            border: 1px solid #e2e8f0; 
            border-radius: 16px; 
            padding: 24px; 
            margin-bottom: 30px; 
            page-break-inside: avoid; 
            background: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
          .type-label { font-weight: 800; text-transform: uppercase; font-size: 14px; letter-spacing: 0.05em; color: #0f172a; }
          .severity-badge { font-size: 10px; padding: 5px 12px; border-radius: 8px; font-weight: 800; letter-spacing: 0.05em; }
          .sev-critical { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
          .sev-high { background: #ffedd5; color: #ea580c; border: 1px solid #fed7aa; }
          .sev-medium { background: #fef9c3; color: #ca8a04; border: 1px solid #fef08a; }
          
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.1em; }
          .content-block { margin-bottom: 20px; }
          .desc-text { font-size: 13px; color: #334155; font-weight: 400; }
          
          .liability-box { 
            background: #fff1f2; 
            padding: 15px; 
            border-radius: 10px; 
            border: 1px solid #fecaca;
            margin-bottom: 20px;
          }
          .liability-text { color: #be123c; font-size: 12px; font-weight: 600; }

          .recommendation-box { 
            background: #f8fafc; 
            padding: 20px; 
            border-radius: 12px; 
            font-size: 12px; 
            border-left: 5px solid #3b82f6; 
            color: #1e293b; 
          }
          
          .compliant-hero { 
            text-align: center; 
            padding: 100px 40px; 
            border: 3px dashed #10b981; 
            border-radius: 30px; 
            background: #f0fdf4; 
            margin-top: 40px; 
          }
          .compliant-icon { font-size: 60px; margin-bottom: 25px; color: #10b981; }
          .compliant-status { font-size: 28px; font-weight: 900; color: #065f46; margin-bottom: 15px; }
          .compliant-desc { color: #065f46; opacity: 0.8; font-size: 16px; max-width: 500px; margin: 0 auto; }
          
          .footer-note {
            position: fixed;
            bottom: 30px;
            left: 40px;
            right: 40px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <div class="logo-circle">H</div>
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
          <div class="target-info">Target Domain: <strong>${safeDomain}</strong> | Issued: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>

        ${isCompliant ? `
          <div class="compliant-hero">
            <div class="compliant-icon">✓</div>
            <div class="compliant-status">SYSTEM COMPLIANT</div>
            <p class="compliant-desc">No high-risk tracking behaviors, unauthorized data transmissions, or missing legal frameworks were detected during this automated statutory audit session.</p>
          </div>
        ` : cleanFindings.map(v => `
          <div class="finding-card">
            <div class="card-head">
              <span class="type-label">${(v.issue_type || 'Statutory Violation').replace(/_/g, ' ')}</span>
              <span class="severity-badge sev-${(v.severity || 'medium').toLowerCase()}">${(v.severity || 'MEDIUM').toUpperCase()}</span>
            </div>
            
            <div class="content-block">
              <div class="section-title">Diagnostic Finding</div>
              <div class="desc-text">${v.description}</div>
            </div>

            <div class="content-block">
              <div class="section-title">Legal Foundation</div>
              <div class="desc-text" style="font-weight: 600;">${v.law_name || 'GDPR Compliance Standards'}</div>
            </div>

            ${v.potential_fine ? `
            <div class="liability-box">
              <div class="section-title" style="color: #be123c;">Potential Liability</div>
              <div class="liability-text">${v.potential_fine}</div>
            </div>
            ` : ''}

            <div class="recommendation-box">
              <div class="section-title" style="color: #3b82f6;">Recommended Remediation</div>
              <div style="font-weight: 500;">${v.recommendation}</div>
            </div>
          </div>
        `).join('')}

        <div class="footer-note">
          bot.humango.app | Statutory Compliance Verified | © 2026 Humango Limited
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

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
  } catch (error) {
    console.error('[PDF Engine Error]', error);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
