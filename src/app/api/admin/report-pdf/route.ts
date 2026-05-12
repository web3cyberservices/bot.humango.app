
import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
  }

  let browser: any = null;
  try {
    const res = await pool.query(`
      SELECT 
        issue_type, page_url, severity, category, description, business_impact,
        fine_amount, law_name, recommendation, explanation, report_type,
        verification_method, created_at
      FROM site_violations 
      WHERE domain = $1 
      ORDER BY 
        CASE 
          WHEN issue_type LIKE '%SYSTEMIC%' THEN 1 
          WHEN issue_type LIKE '%IDENTITY%' THEN 2 
          WHEN issue_type LIKE '%RETENTION%' THEN 3
          WHEN issue_type LIKE '%PURPOSE%' THEN 4 
          ELSE 5 
        END,
        severity DESC
    `, [domain]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'No audit data found for this domain.' }, { status: 404 });
    }

    // CONSOLIDATION ENGINE: Group by Violation Logic (Statutory Article)
    const consolidated = new Map();
    res.rows.forEach(row => {
      const key = row.issue_type; 
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...row, urls: new Set([row.page_url]) });
      } else {
        consolidated.get(key).urls.add(row.page_url);
      }
    });

    const findings = Array.from(consolidated.values());
    const criticalRisks = findings.filter(f => f.severity === 'critical' || f.issue_type.includes('SYSTEMIC'));
    const identityRisks = findings.filter(f => f.issue_type.includes('IDENTITY') || f.category === 'IMPRESSUM');
    const legalGrounds = findings.filter(f => f.category === 'LEGAL_GROUNDS' || f.issue_type.includes('RETENTION'));
    const others = findings.filter(f => !criticalRisks.includes(f) && !identityRisks.includes(f) && !legalGrounds.includes(f));

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
          @page { margin: 0; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; padding: 40px; line-height: 1.4; background: #ffffff; font-size: 10px; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-text { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin: 30px 0 15px 0; letter-spacing: 1px; }
          .violation-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 12px; background: #ffffff; page-break-inside: avoid; overflow: hidden; }
          .violation-head { background: #0f172a; color: #ffffff; padding: 8px 15px; font-weight: 800; font-size: 9px; display: flex; justify-content: space-between; }
          .violation-body { padding: 15px; }
          .label { font-size: 7px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-top: 10px; display: block; margin-bottom: 2px; }
          .risk-badge { font-size: 7px; font-weight: 800; padding: 1px 6px; border-radius: 99px; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .impact-box { background: #fff7ed; border-left: 2px solid #f97316; padding: 8px; color: #9a3412; font-weight: 600; font-size: 8px; margin: 8px 0; }
          .blueprint { background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px; border-radius: 4px; color: #0369a1; font-size: 8px; white-space: pre-line; }
          .url-list { font-size: 7px; color: #64748b; background: #f8fafc; padding: 6px; border-radius: 4px; font-family: monospace; border: 1px solid #e2e8f0; margin-top: 3px; list-style: none; padding-left: 12px; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .footer-note { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 7px; color: #94a3b8; }
          .explanation-text { color: #334155; font-size: 8px; margin-top: 4px; }
          .term-box { background: #f1f5f9; padding: 8px; border-radius: 6px; margin: 10px 0; font-size: 8px; color: #475569; border: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:10px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:25px; height:25px">` : ''}
            <div class="logo-text">Humango Compliance Audit Engine</div>
          </div>
          <div style="text-align:right; font-size:7px; color:#64748b; font-weight:600">
            Node: ${domain} | Senior Auditor V21.0
          </div>
        </div>

        <div class="summary-card">
          <h1 style="font-size:16px; color:#0f172a; margin:0 0 5px 0; font-weight:800">Executive Statutory Summary</h1>
          <p style="color:#64748b; margin:0; font-size:9px">Consolidated legal diagnostic regarding statutory transparency and processing operations.</p>
          <div class="term-box">
            <strong>Verification Methods:</strong><br>
            • <em>Static Analysis:</em> Rapid structural audit of source code and headers.<br>
            • <em>Dynamic Emulation:</em> Deep rendering of JavaScript-heavy components and interaction simulation.
          </div>
        </div>

        ${criticalRisks.length > 0 ? `
          <div class="section-title">I. Mandatory Legal Infrastructure</div>
          ${criticalRisks.map(renderViolation).join('')}
        ` : ''}

        ${identityRisks.length > 0 ? `
          <div class="section-title">II. Controller Accountability & Identity</div>
          ${identityRisks.map(renderViolation).join('')}
        ` : ''}

        ${legalGrounds.length > 0 ? `
          <div class="section-title">III. Data Processing & Legal Grounds</div>
          ${legalGrounds.map(renderViolation).join('')}
        ` : ''}

        ${others.length > 0 ? `
          <div class="section-title">IV. Transparency Framework & User Rights</div>
          ${others.map(renderViolation).join('')}
        ` : ''}

        <div class="footer-note">
          Confidential Legal Audit &bull; Humango Compliance Audit Engine &bull; Statutory V21.0
        </div>
      </body>
      </html>
    `;

    function renderViolation(v: any) {
      const urls = Array.from(v.urls);
      return `
        <div class="violation-card">
          <div class="violation-head">
            <span>${v.issue_type}</span>
            <span class="risk-badge">${v.severity.toUpperCase()} RISK</span>
          </div>
          <div class="violation-body">
            <span class="label">STATUTORY BASIS / LEGAL DEFINITION</span>
            <div style="font-weight:800; font-size:8px; color:#0f172a">${v.law_name}</div>
            <div class="explanation-text">${v.explanation}</div>

            <span class="label">DIAGNOSTIC DESCRIPTION</span>
            <div style="color:#334155; font-size:8px;">${v.description}</div>

            <span class="label">BUSINESS IMPACT</span>
            <div class="impact-box">${v.business_impact}</div>

            <span class="label">ADMINISTRATIVE LIABILITY</span>
            <div style="color:#ef4444; font-weight:700; font-size:8px;">${v.fine_amount}</div>

            <span class="label">TARGETED RESOURCE(S)</span>
            <ul class="url-list">
              ${urls.map(u => `<li>&bull; ${u}</li>`).join('')}
            </ul>

            <span class="label">STEP-BY-STEP CORRECTIVE ACTION</span>
            <div class="blueprint">${v.recommendation}</div>
            
            <div style="margin-top:10px; font-size:6px; color:#94a3b8; text-transform:uppercase;">
              Verification Method: ${v.verification_method} | Report: ${v.report_type}
            </div>
          </div>
        </div>
      `;
    }

    let executablePath = '';
    for (const p of CHROME_PATHS) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }

    browser = await puppeteer.launch({ 
      executablePath: executablePath || undefined,
      headless: 'new', 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    return new NextResponse(pdfBuffer, { 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain}.pdf` 
      } 
    });
  } catch (error: any) {
    console.error('[PDF API CRASH]', error);
    return NextResponse.json({ error: 'Failed to generate report: ' + error.message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
