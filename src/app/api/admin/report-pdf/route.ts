
import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
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
          WHEN issue_type LIKE '%PURPOSE%' THEN 3 
          ELSE 4 
        END,
        severity DESC
    `, [domain]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'No audit data found for this domain.' }, { status: 404 });
    }

    // AUDITOR V21.0 HARD MERGE: Consolidated by Issue Type (Article)
    const consolidated = new Map();
    res.rows.forEach(row => {
      const key = row.issue_type; // Group by Article/Issue Type
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...row, urls: new Set([row.page_url]) });
      } else {
        consolidated.get(key).urls.add(row.page_url);
      }
    });

    const findings = Array.from(consolidated.values());
    const systemicRisks = findings.filter(f => f.issue_type.includes('SYSTEMIC'));
    const identityRisks = findings.filter(f => f.issue_type.includes('IDENTITY') || f.category === 'IMPRESSUM');
    const processingRisks = findings.filter(f => f.category === 'LEGAL_GROUNDS');
    const otherRisks = findings.filter(f => !systemicRisks.includes(f) && !identityRisks.includes(f) && !processingRisks.includes(f));

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
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; padding: 45px; line-height: 1.5; background: #ffffff; font-size: 11px; }
          .header { border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-text { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #3b82f6; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin: 40px 0 20px 0; letter-spacing: 1px; }
          .violation-card { border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 15px; background: #ffffff; page-break-inside: avoid; overflow: hidden; }
          .violation-head { background: #0f172a; color: #ffffff; padding: 10px 18px; font-weight: 800; font-size: 10px; display: flex; justify-content: space-between; }
          .violation-body { padding: 18px; }
          .label { font-size: 8px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-top: 12px; display: block; margin-bottom: 3px; }
          .risk-badge { font-size: 8px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .impact-box { background: #fff7ed; border-left: 3px solid #f97316; padding: 10px; color: #9a3412; font-weight: 600; font-size: 9px; margin: 10px 0; }
          .blueprint { background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px; border-radius: 6px; color: #0369a1; font-size: 9px; }
          .url-list { font-size: 8px; color: #64748b; background: #f8fafc; padding: 8px; border-radius: 4px; font-family: monospace; border: 1px solid #e2e8f0; margin-top: 4px; list-style: none; padding-left: 15px; }
          .url-list li { margin-bottom: 2px; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 25px; }
          .footer-note { position: fixed; bottom: 30px; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; }
          .processing-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
          .processing-table th { background: #0f172a; color: white; text-align: left; padding: 8px; }
          .processing-table td { border: 1px solid #e2e8f0; padding: 8px; }
          .manifesto-box { border: 1px dashed #cbd5e1; padding: 15px; margin-top: 40px; background: #fdfdfd; border-radius: 8px; }
          .manifesto-title { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: block; }
          .manifesto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .manifesto-item { font-size: 8px; color: #334155; }
          .manifesto-label { font-weight: 800; color: #94a3b8; text-transform: uppercase; font-size: 7px; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:30px; height:30px">` : ''}
            <div class="logo-text">Humango Compliance Audit Engine</div>
          </div>
          <div style="text-align:right; font-size:8px; color:#64748b; font-weight:600">
            Node: ${domain} | GDPR V21.0
          </div>
        </div>

        <div class="summary-card">
          <h1 style="font-size:20px; color:#0f172a; margin:0 0 5px 0; font-weight:800">Executive Statutory Summary</h1>
          <p style="color:#64748b; margin:0; font-size:10px">Consolidated legal diagnostic regarding transparency (Art. 12/13) and processing grounds (Art. 6).</p>
        </div>

        ${systemicRisks.length > 0 ? `
          <div class="section-title">I. Mandatory Legal Infrastructure</div>
          ${systemicRisks.map(renderViolation).join('')}
        ` : ''}

        ${identityRisks.length > 0 ? `
          <div class="section-title">II. Controller Accountability & Identity</div>
          ${identityRisks.map(renderViolation).join('')}
        ` : ''}

        ${processingRisks.length > 0 ? `
          <div class="section-title">III. Audit of Processing Operations (Art. 13-1-c/d)</div>
          <div class="violation-card">
            <div class="violation-head">PURPOSE-TO-BASIS CORRELATION AUDIT</div>
            <div class="violation-body">
              <table class="processing-table">
                <thead>
                  <tr>
                    <th>Detected Activity</th>
                    <th>Statutory Requirement (Art. 6)</th>
                    <th>Diagnostic Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Usage Analysis / Analytics</td><td>Art. 6(1)(f) + Description</td><td>Deficient</td></tr>
                  <tr><td>Fraud Prevention / Security</td><td>Art. 6(1)(f) + Description</td><td>Deficient</td></tr>
                  <tr><td>Customer Support</td><td>Art. 6(1)(b) Contractual</td><td>Missing Correlation</td></tr>
                </tbody>
              </table>
              ${processingRisks.map(renderViolation).join('')}
            </div>
          </div>
        ` : ''}

        ${otherRisks.length > 0 ? `
          <div class="section-title">IV. Transparency Framework & Rights</div>
          ${otherRisks.map(renderViolation).join('')}
        ` : ''}

        <div class="manifesto-box">
          <span class="manifesto-title">Audit Network Verification Manifesto</span>
          <div class="manifesto-grid">
            <div>
              <div class="manifesto-item">
                <div class="manifesto-label">Audit Operator</div>
                <strong>Humango Limited</strong>
              </div>
              <div class="manifesto-item" style="margin-top:8px">
                <div class="manifesto-label">Registered Office</div>
                182-184 High Street North, London, England, E6 2JA
              </div>
              <div class="manifesto-item" style="margin-top:8px">
                <div class="manifesto-label">Corporate Identifier</div>
                Company Registration No: 16750477 (UK)
              </div>
            </div>
            <div>
              <div class="manifesto-item">
                <div class="manifesto-label">Verified User-Agent</div>
                HumangoBot/1.0 (+https://bot.humango.app)
              </div>
              <div class="manifesto-item" style="margin-top:8px">
                <div class="manifesto-label">Network Infrastructure</div>
                IP: 116.203.3.75 | bot.humango.app
              </div>
              <div class="manifesto-item" style="margin-top:8px">
                <div class="manifesto-label">Statutory DPO Contact</div>
                abuse@humango.app
              </div>
            </div>
          </div>
        </div>

        <div class="footer-note">
          Confidential Legal Audit &bull; Humango Compliance Audit Engine &bull; Senior Auditor V21.0
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
            <span class="label">STATUS / LEGAL BASIS</span>
            <div style="font-weight:800; font-size:9px; color:#0f172a">${v.law_name}</div>

            <span class="label">DIAGNOSTIC DESCRIPTION</span>
            <div style="color:#334155; font-size:9px;">${v.description}</div>

            <span class="label">BUSINESS IMPACT</span>
            <div class="impact-box">${v.business_impact || 'Lack of statutory compliance marks the entity as a high-priority target for regulatory scrutiny and bad-faith findings.'}</div>

            <span class="label">ADMINISTRATIVE LIABILITY</span>
            <div style="color:#ef4444; font-weight:700; font-size:9px;">Potential Administrative Liability: Up to €20,000,000 or 4% of annual global turnover (Art. 83 GDPR)</div>

            <span class="label">TARGETED RESOURCE(S)</span>
            <ul class="url-list">
              ${urls.map(u => `<li>&bull; ${u}</li>`).join('')}
            </ul>

            <span class="label">REMEDIATION BLUEPRINT</span>
            <div class="blueprint">${(v.recommendation || '').replace(/\n/g, '<br>')}</div>
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
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
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
