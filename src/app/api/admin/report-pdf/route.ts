
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

/**
 * ПРЯМАЯ ИНСТРУКЦИЯ: ПОЛНЫЙ ДОСТУП К PDF ДЛЯ ВСЕХ
 * ЭТА API-РУТКА ТЕПЕРЬ ПУБЛИЧНАЯ.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 });

  let browser: any = null;
  try {
    // Check for column existence to prevent 500 error if migration hasn't finished
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'site_violations'
    `);
    const existingCols = colCheck.rows.map(r => r.column_name);
    
    const hasVerificationMethod = existingCols.includes('verification_method');
    const hasFineAmount = existingCols.includes('fine_amount');
    const hasRecommendation = existingCols.includes('recommendation');
    const hasSnippet = existingCols.includes('snippet');
    const hasLawName = existingCols.includes('law_name');

    // Build resilient query
    const res = await pool.query(`
      SELECT DISTINCT ON (issue_type, page_url) 
        page_url, 
        issue_type, 
        severity, 
        explanation, 
        ${hasFineAmount ? 'fine_amount' : "'' as fine_amount"}, 
        ${hasLawName ? 'law_name' : "'GDPR / ePrivacy' as law_name"}, 
        created_at, 
        ${hasRecommendation ? 'recommendation' : "'Remediation required' as recommendation"}, 
        ${hasSnippet ? 'snippet' : "'' as snippet"}, 
        ${hasVerificationMethod ? 'verification_method' : "'Static Analysis' as verification_method"}
      FROM site_violations WHERE domain = $1 ORDER BY issue_type, page_url, created_at DESC
    `, [domain]);

    const violations = res.rows;
    if (violations.length === 0) return NextResponse.json({ error: 'No violations found for this target.' }, { status: 404 });

    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    } catch (e) {}

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; background: #fff; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo-img { width: 48px; height: 48px; object-fit: contain; }
          .logo-text { font-size: 24px; font-weight: bold; color: #0f172a; }
          .title-section { margin-bottom: 30px; }
          .title { font-size: 22px; font-weight: bold; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 15px; }
          .domain-badge { background: #eff6ff; color: #3b82f6; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; }
          .violation-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 25px; page-break-inside: avoid; overflow: hidden; }
          .violation-header { background: #f8fafc; padding: 15px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
          .violation-type { font-weight: bold; font-size: 14px; color: #0f172a; }
          .violation-body { padding: 20px; }
          .severity-badge { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 3px 8px; border-radius: 99px; display: inline-block; margin-bottom: 12px; }
          .critical { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .high { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
          .label { font-size: 10px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; display: block; }
          .fine { font-size: 12px; font-weight: bold; color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ef4444; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; }
          .contact-link { color: #3b82f6; font-weight: bold; text-decoration: none; font-size: 12px; background: #eff6ff; padding: 4px 12px; border-radius: 6px; border: 1px solid #3b82f6; }
          .footer-logo { width: 32px; height: 32px; object-fit: contain; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : ''}
            <div class="logo-text">Humango Compliance</div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b">
            Official Audit Report<br>Generated on ${new Date().toLocaleDateString('en-GB')}
          </div>
        </div>
        <div class="title-section">
          <div class="title">Compliance & Vulnerability Assessment</div>
          <div style="margin-top:15px">Audit Target: <span class="domain-badge">${domain}</span></div>
        </div>

        ${violations.map(item => `
          <div class="violation-item">
            <div class="violation-header">
              <span class="violation-type">${item.issue_type}</span>
              <span style="font-size:9px; color:#64748b">Verification: ${item.verification_method}</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${item.severity}">${item.severity} Risk</span>
              
              <span class="label">Diagnostic Explanation</span>
              <div style="font-size:12px; margin-bottom:15px">${item.explanation || item.description || ''}</div>
              
              <span class="label">Legal Foundation</span>
              <div style="font-size:11px; font-weight:bold; margin-bottom:15px">${item.law_name}</div>
              
              <span class="label">Administrative Liability Range (Art. 83 GDPR / National Law)</span>
              <div class="fine">${item.fine_amount || 'Up to €20,000,000 or 4% of annual global turnover.'}</div>
              
              <span class="label">Affected Resource</span>
              <div style="font-size:11px; color:#64748b; margin-bottom:15px; word-break: break-all;">${item.page_url}</div>

              <span class="label">Corrective Action Required</span>
              <div style="background:#ecfdf5; border:1px solid #d1fae5; padding:15px; border-radius:8px; color:#065f46; font-size:11px">
                <strong>Mandatory Remediation:</strong> ${item.recommendation}
              </div>
            </div>
          </div>
        `).join('')}

        <div class="footer">
          <div>
            &copy; ${new Date().getFullYear()} Humango Limited • London • E6 2JA<br>
            Verification Support: <a href="mailto:abuse@humango.app" class="contact-link">abuse@humango.app</a>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo">` : ''}
        </div>
      </body>
      </html>
    `;

    // Robust Puppeteer Launch
    browser = await puppeteer.launch({ 
      executablePath: CHROME_PATH, 
      headless: 'new', 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true, 
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } 
    });

    return new NextResponse(pdfBuffer, { 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain.replace(/\./g, '_')}.pdf` 
      } 
    });
  } catch (error: any) {
    console.error('[PDF API Error]', error);
    return NextResponse.json({ error: 'Failed to generate report', message: error.message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
