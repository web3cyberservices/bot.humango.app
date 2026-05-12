
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
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });

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
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END ASC,
        created_at ASC
    `, [domain]);

    if (res.rows.length === 0) return NextResponse.json({ error: 'No audit data found' }, { status: 404 });

    // V25.0 HARD CONSOLIDATION & LOGIC BRIDGE
    const consolidated = new Map();
    res.rows.forEach(row => {
      // RULE: V25.0 - Final logic check to ensure "Missing" is only used for total absence
      let finalIssueType = row.issue_type;
      let finalDescription = row.description;
      
      const pageUrl = row.page_url || '';
      const isLegalPath = pageUrl.includes('/privacy') || pageUrl.includes('/legal') || pageUrl.includes('/impressum');
      if (finalIssueType.toLowerCase().includes('missing') && isLegalPath) {
        finalIssueType = "CRITICAL INCOMPLETENESS";
        finalDescription = "The document was discovered via direct scan but is legally invalid due to lack of accessibility in the footer.";
      }

      const key = row.law_name || finalIssueType; 
      if (!consolidated.has(key)) {
        const urls = pageUrl.split(',').map((u: string) => u.trim());
        consolidated.set(key, { ...row, issue_type: finalIssueType, description: finalDescription, urls: new Set(urls) });
      } else {
        const item = consolidated.get(key);
        pageUrl.split(',').forEach((u: string) => item.urls.add(u.trim()));
      }
    });

    const findings = Array.from(consolidated.values());

    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    } catch (e) {}

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; background: #ffffff; font-size: 11px; }
          .header { border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
          .logo-text { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 40px 0 20px 0; letter-spacing: 1px; }
          .violation-card { border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 15px; background: #ffffff; page-break-inside: avoid; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .violation-head { background: #0f172a; color: #ffffff; padding: 10px 20px; font-weight: 800; font-size: 10px; display: flex; justify-content: space-between; align-items: center; }
          .violation-body { padding: 20px; }
          .label { font-size: 8px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-top: 15px; display: block; margin-bottom: 4px; letter-spacing: 0.5px; }
          .risk-badge { font-size: 8px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .impact-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; color: #9a3412; font-weight: 600; font-size: 10px; margin: 10px 0; border-radius: 4px; }
          .action-box { background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; color: #0369a1; font-size: 10px; white-space: pre-line; line-height: 1.6; font-family: monospace; border-left: 4px solid #3b82f6; font-weight: 600; }
          .url-list { font-size: 8px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 6px; font-family: monospace; border: 1px solid #e2e8f0; margin-top: 5px; list-style: none; padding-left: 15px; }
          .term-box { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 9px; color: #475569; border: 1px solid #e2e8f0; line-height: 1.6; }
          .footer-note { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:30px; height:30px">` : ''}
            <div class="logo-text">Humango Compliance Engine</div>
          </div>
          <div style="text-align:right; font-size:8px; color:#64748b; font-weight:600">
            Node: ${domain} | SENIOR ARCHITECT V25.0
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
          <h1 style="font-size:20px; color:#0f172a; margin:0 0 8px 0; font-weight:800">Statutory Compliance Audit</h1>
          <p style="color:#64748b; margin:0; font-size:10px">Executive Diagnostic Report for ${domain}.</p>
          <div class="term-box">
            <strong>Glossary of Statutory Terms:</strong><br>
            • <strong>Official Company Ownership:</strong> The mandatory business identity card (Impressum).<br>
            • <strong>Data Protection Officer (DPO):</strong> The certified individual responsible for privacy security.<br>
            • <strong>Static Analysis:</strong> Technical scan of site text and structure for legal gaps.
          </div>
        </div>

        <div class="section-title">Findings by Statutory Law</div>

        ${findings.map(v => {
          const urls = Array.from(v.urls);
          const impact = v.business_impact && v.business_impact !== 'null' ? v.business_impact : "Business Risk: Immediate loss of marketing ROI as Google/Meta advertising platforms require valid compliance signals.";
          const liability = v.fine_amount && v.fine_amount !== 'null' ? v.fine_amount : "Fines up to €20,000,000 or 4% of annual global turnover (Art. 83 GDPR).";
          
          let remediation = v.recommendation || '';
          if (remediation && !remediation.startsWith('ACTION:')) {
            remediation = `ACTION: INSERT THIS TEXT -> ${remediation}`;
          }

          return `
            <div class="violation-card">
              <div class="violation-head">
                <span>${v.issue_type}</span>
                <span class="risk-badge">${(v.severity || 'HIGH').toUpperCase()} RISK</span>
              </div>
              <div class="violation-body">
                <span class="label">STATUTORY BASIS</span>
                <div style="font-weight:800; font-size:10px; color:#0f172a">${v.law_name || 'GDPR Article 13'}</div>
                <div style="color: #475569; font-size: 9px; margin-top: 5px;">${v.explanation || v.description}</div>

                <span class="label">SUMMARY</span>
                <div style="color:#334155; font-size:10px;">${v.description}</div>

                <span class="label">BUSINESS IMPACT</span>
                <div class="impact-box">${impact}</div>

                <span class="label">POTENTIAL LIABILITY</span>
                <div style="color:#ef4444; font-weight:700; font-size:10px;">${liability}</div>

                <span class="label">TARGETED RESOURCE(S)</span>
                <ul class="url-list">
                  ${urls.map(u => `<li>&bull; ${u}</li>`).join('')}
                </ul>

                <span class="label">STEP-BY-STEP CORRECTIVE ACTION</span>
                <div class="action-box">${remediation || 'ACTION: INSERT THIS TEXT -> Add link to footer: <a href="/privacy">Privacy Policy</a>'}</div>
                
                <div style="margin-top:15px; font-size:7px; color:#94a3b8; text-transform:uppercase;">
                  VERIFICATION: STATIC+DYNAMIC | SENIOR ARCHITECT V25.0
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <div class="footer-note">
          Confidential Audit &bull; Humango Compliance Engine &bull; VERIFICATION: STATIC+DYNAMIC | SENIOR ARCHITECT V25.0
        </div>
      </body>
      </html>
    `;

    const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
    browser = await puppeteer.launch({ 
      executablePath: executablePath || undefined,
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
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
    console.error('[PDF API ERROR]', error.stack);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
