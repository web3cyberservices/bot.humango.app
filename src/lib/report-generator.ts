
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * Professional PDF Report Generator
 * Features: Duplicate filtering, Corporate Header, Strict Page Logic.
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
  type?: string;
  severity: string;
  description?: string;
  summary?: string;
  law_name?: string;
  recommendation?: string;
  action?: string;
  business_impact?: string;
}

export async function generatePdfReport(domain: string, findings: Finding[] = []): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const safeDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    
    // 1. FILTERING LOGIC: Remove duplicates by issue_type
    const uniqueFindingsMap = new Map();
    findings.forEach(f => {
      const type = f.issue_type || f.type || 'UNKNOWN_ISSUE';
      if (!uniqueFindingsMap.has(type)) {
        uniqueFindingsMap.set(type, f);
      }
    });
    
    const cleanFindings = Array.from(uniqueFindingsMap.values());
    const isCompliant = cleanFindings.length === 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            margin: 0;
            padding: 40px 60px;
            background: #ffffff;
          }
          /* HEADER DESIGN */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 40px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-circle {
            width: 32px;
            height: 32px;
            background: #3b82f6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 18px;
          }
          .brand-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .brand-name span { color: #3b82f6; }
          
          .header-right {
            text-align: right;
            font-size: 10px;
            color: #64748b;
            line-height: 1.4;
          }
          .header-right strong { color: #334155; }

          /* CONTENT STYLES */
          .report-meta { margin-bottom: 30px; }
          .report-title {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 8px 0;
            text-transform: uppercase;
          }
          .report-domain {
            font-size: 14px;
            color: #64748b;
            font-weight: 500;
          }
          .report-domain span { color: #0f172a; font-weight: 700; }

          /* STATUS BOXES */
          .status-card {
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
          }
          .status-compliant {
            background: #f0fdf4;
            border-color: #bcf0da;
            text-align: center;
          }
          .status-compliant h2 { color: #166534; font-size: 20px; margin-bottom: 10px; }
          .status-compliant p { color: #15803d; font-size: 13px; margin: 0; }

          /* VIOLATION CARDS */
          .finding-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          .finding-type {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
          }
          .severity-badge {
            font-size: 9px;
            font-weight: 900;
            padding: 4px 10px;
            border-radius: 6px;
            background: #fef2f2;
            color: #ef4444;
            border: 1px solid #fee2e2;
          }
          .finding-description {
            font-size: 13px;
            color: #475569;
            margin-bottom: 20px;
          }
          .finding-meta {
            font-size: 11px;
            margin-bottom: 15px;
          }
          .meta-label { font-weight: 700; color: #64748b; text-transform: uppercase; margin-right: 5px; }

          .action-box {
            background: #f8fafc;
            border: 1px solid #f1f5f9;
            border-radius: 8px;
            padding: 15px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
            color: #334155;
          }
          .action-label {
            font-size: 10px;
            font-weight: 900;
            color: #3b82f6;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <!-- CORPORATE HEADER -->
        <header class="header">
          <div class="header-left">
            <div class="logo-circle">H</div>
            <div class="brand-name">Humango<span>Compliance</span></div>
          </div>
          <div class="header-right">
            <strong>Operator:</strong> Humango Limited | Co. No: 16750477<br>
            <strong>Address:</strong> 182-184 High Street North, London, E6 2JA<br>
            <strong>Contact:</strong> abuse@humango.app | RFC 9309 Statutory Audit Node
          </div>
        </header>

        <!-- REPORT META -->
        <div class="report-meta">
          <h1 class="report-title">Statutory Audit Report</h1>
          <div class="report-domain">Infrastructure Diagnosis for: <span>${safeDomain}</span></div>
        </div>

        ${isCompliant ? `
          <!-- COMPLIANT STATUS -->
          <div class="status-card status-compliant">
            <div style="font-size: 40px; margin-bottom: 15px;">✓</div>
            <h2>STATUTORY COMPLIANCE VERIFIED</h2>
            <p>The analyzed infrastructure meets current digital transparency requirements. No core framework violations identified during this scan session.</p>
          </div>
        ` : cleanFindings.map(v => `
          <!-- VIOLATION BLOCK -->
          <div class="finding-card">
            <div class="finding-header">
              <div class="finding-type">${(v.issue_type || v.type || 'POLICY_VIOLATION').replace(/_/g, ' ')}</div>
              <div class="severity-badge">${v.severity.toUpperCase()}</div>
            </div>
            <div class="finding-description">${v.description || v.summary}</div>
            
            <div class="finding-meta">
              <span class="meta-label">Legal Foundation:</span> ${v.law_name || 'Art. 13 GDPR'}
            </div>

            <div class="action-label">Recommended Remediation:</div>
            <div class="action-box">
              ${(v.recommendation || v.action || '').replace(/'/g, '"')}
            </div>
          </div>
        `).join('')}

      </body>
      </html>
    `;

    const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
    browser = await puppeteer.launch({
      executablePath: executablePath || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; color: #94a3b8; text-align: center; font-family: sans-serif; padding-bottom: 10px;">
          bot.humango.app | Statutory Compliance Verified | © 2026 Humango Limited | Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
      margin: { top: '40px', bottom: '60px' }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('[PDF Engine Error]', error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
