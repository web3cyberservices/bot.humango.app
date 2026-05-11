
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 });

  let browser: any = null;
  try {
    const res = await pool.query(`
      SELECT page_url, issue_type, severity, explanation, fine_amount, law_name, created_at
      FROM site_violations WHERE domain = $1 ORDER BY created_at DESC
    `, [domain]);

    const violations = res.rows;
    if (violations.length === 0) return NextResponse.json({ error: 'No violations found' }, { status: 404 });

    // Grouping for Deduplication in PDF with professional labeling
    const groupedMap = new Map();
    violations.forEach(v => {
      const key = `${v.issue_type}_${v.law_name}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { ...v, urls: new Set([v.page_url]) });
      } else {
        groupedMap.get(key).urls.add(v.page_url);
      }
    });
    const groupedArray = Array.from(groupedMap.values()).map(v => ({...v, urls: Array.from(v.urls)}));

    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    } catch (e) {}

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; background: #fff; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo-img { width: 48px; height: 48px; object-fit: contain; }
          .logo-text { font-size: 24px; font-weight: bold; color: #0f172a; }
          .company-info { font-size: 10px; color: #64748b; text-align: right; }
          .title-section { margin-bottom: 30px; }
          .title { font-size: 18px; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
          .domain-badge { background: #eff6ff; color: #3b82f6; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; }
          .violation-item { border: 1px solid #f1f5f9; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
          .violation-header { background: #fdfdfd; padding: 15px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
          .violation-type { font-weight: bold; font-size: 14px; }
          .violation-body { padding: 15px; }
          .severity-badge { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 10px; }
          .critical { background: #fef2f2; color: #ef4444; }
          .explanation { font-size: 12px; color: #475569; margin-bottom: 10px; }
          .fine { font-size: 12px; font-weight: bold; color: #ef4444; }
          .url-list { font-family: monospace; font-size: 9px; color: #3b82f6; list-style: none; padding: 0; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 9px; }
          .contact-link { color: #3b82f6; font-weight: bold; text-decoration: none; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : ''}
            <div class="logo-text">HUMANGO BOT</div>
          </div>
          <div class="company-info">
            <strong>HUMANGO LIMITED</strong><br>London, England, E6 2JA
          </div>
        </div>
        <div class="title-section">
          <div class="title">Official Compliance Audit Report</div>
          <div style="margin-top:10px">Audit Target: <span class="domain-badge">${domain}</span></div>
        </div>
        ${groupedArray.map(item => `
          <div class="violation-item">
            <div class="violation-header">
              <span class="violation-type">${item.issue_type}</span>
              <span style="font-size:10px; color:#64748b">Automated Detection: High Confidence</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${item.severity}">${item.severity} Risk</span>
              <div class="explanation">${item.explanation}</div>
              <div style="font-size:10px; color:#94a3b8; margin-bottom:5px">Legal Ground: ${item.law_name}</div>
              <div class="fine">Financial Liability: ${item.fine_amount}</div>
              <div style="margin-top:10px; font-weight:bold; font-size:10px">Validated Points (${item.urls.length}):</div>
              <ul class="url-list">${item.urls.slice(0, 10).map(u => `<li>${u}</li>`).join('')}${item.urls.length > 10 ? '<li>... and more (deduplicated)</li>' : ''}</ul>
            </div>
          </div>
        `).join('')}
        <div class="footer">
          <div>
            &copy; ${new Date().getFullYear()} Humango Compliance Systems<br>
            Direct Verification Support: <a href="mailto:abuse@humango.app" class="contact-link">abuse@humango.app</a>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" style="width:32px; height:32px">` : ''}
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    return new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=Humango_Audit_${domain}.pdf` } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
