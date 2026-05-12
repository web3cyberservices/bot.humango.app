
import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 });

  let browser: any = null;
  try {
    const res = await pool.query(`
      SELECT 
        issue_type, page_url, severity, category, description, 
        fine_amount, law_name, recommendation, explanation, report_type
      FROM site_violations 
      WHERE domain = $1 
      ORDER BY 
        CASE 
          WHEN issue_type LIKE '%MISSING%' THEN 1 
          WHEN issue_type LIKE '%CONTROLLER%' THEN 2 
          WHEN issue_type LIKE '%PROCESSING%' THEN 3 
          ELSE 4 
        END,
        severity DESC
    `, [domain]);

    if (res.rows.length === 0) return NextResponse.json({ error: 'Audit history not found.' }, { status: 404 });

    // EXPERT DEDUPLICATION & GROUPING
    const universalFindings: any[] = [];
    const countryFindings: any[] = [];
    
    const consolidated = new Map();
    res.rows.forEach(row => {
      const key = `${row.category}_${row.issue_type}`.toUpperCase();
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...row, urls: new Set([row.page_url]) });
      } else {
        consolidated.get(key).urls.add(row.page_url);
      }
    });

    consolidated.forEach(v => {
      const type = v.issue_type.toUpperCase();
      if (type.includes('IMPRESSUM') || type.includes('MENTIONS') || type.includes('RODO')) {
        countryFindings.push(v);
      } else {
        universalFindings.push(v);
      }
    });

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
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 30px; line-height: 1.4; background: #ffffff; font-size: 10px; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-text { font-size: 16px; font-weight: bold; color: #0f172a; }
          .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin: 30px 0 15px 0; }
          .violation-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 15px; background: #ffffff; page-break-inside: avoid; overflow: hidden; }
          .violation-head { background: #0f172a; color: #ffffff; padding: 10px 15px; font-weight: bold; font-size: 11px; display: flex; justify-content: space-between; }
          .violation-body { padding: 15px; }
          .label { font-size: 8px; font-weight: bold; color: #3b82f6; text-transform: uppercase; margin-top: 12px; display: block; margin-bottom: 4px; }
          .risk-badge { font-size: 7px; font-weight: bold; padding: 2px 8px; border-radius: 99px; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .fine-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; color: #ef4444; font-weight: bold; margin: 15px 0; font-size: 9px; }
          .blueprint { background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px; border-radius: 6px; color: #0369a1; font-size: 9px; margin-top: 5px; }
          .url-list { font-size: 7px; color: #64748b; background: #f8fafc; padding: 8px; border-radius: 4px; font-family: monospace; border: 1px solid #e2e8f0; }
          .footer { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:10px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:30px; height:30px">` : ''}
            <div class="logo-text">Humango Compliance Audit Engine</div>
          </div>
          <div style="text-align:right; font-size:8px; color:#64748b">Pan-European Engine v5.0<br>Target: ${domain}</div>
        </div>

        <h1 style="font-size:22px; color:#0f172a; margin-bottom:5px">Statutory Assessment Report</h1>
        <p style="color:#64748b; margin-bottom:30px">Consolidated audit of digital infrastructure and transparency requirements under GDPR.</p>

        <div class="section-title">SECTION A: UNIVERSAL GDPR REQUIREMENTS</div>
        ${universalFindings.map(v => `
          <div class="violation-card">
            <div class="violation-head">
              <span>${v.issue_type}</span>
              <span class="risk-badge">${v.severity.toUpperCase()} RISK</span>
            </div>
            <div class="violation-body">
              <span class="label">STATUS / LEGAL BASIS</span>
              <div style="font-weight:bold">${v.law_name}</div>

              <span class="label">DIAGNOSTIC DESCRIPTION</span>
              <div style="color:#334155">${v.description}</div>

              <div class="fine-box">Administrative Liability: ${v.fine_amount}</div>

              <span class="label">Targeted Resource(s)</span>
              <div class="url-list">${Array.from(v.urls).join('<br>')}</div>

              <span class="label">REMEDIATION BLUEPRINT</span>
              <div class="blueprint">${v.recommendation}</div>
            </div>
          </div>
        `).join('')}

        ${countryFindings.length > 0 ? `
          <div class="section-title">SECTION B: COUNTRY-SPECIFIC SUPPLEMENTS</div>
          ${countryFindings.map(v => `
            <div class="violation-card">
              <div class="violation-head">
                <span>${v.issue_type}</span>
                <span class="risk-badge">${v.severity.toUpperCase()} RISK</span>
              </div>
              <div class="violation-body">
                <span class="label">STATUS / LEGAL BASIS</span>
                <div style="font-weight:bold">${v.law_name}</div>

                <span class="label">DIAGNOSTIC DESCRIPTION</span>
                <div style="color:#334155">${v.description}</div>

                <div class="fine-box">Administrative Liability: ${v.fine_amount}</div>

                <span class="label">REMEDIATION BLUEPRINT</span>
                <div class="blueprint">${v.recommendation}</div>
              </div>
            </div>
          `).join('')}
        ` : ''}

        <div class="footer">
          Confidential Audit &bull; Generated by Humango Compliance Audit Engine &bull; GDPR Art. 13 Compliance &bull; EU-wide
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({ 
      executable_path: CHROME_PATH, 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
    });

    return new NextResponse(pdfBuffer, { 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain}.pdf` 
      } 
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
