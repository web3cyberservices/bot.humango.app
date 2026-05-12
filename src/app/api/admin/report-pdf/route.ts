
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
    const colCheck = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'site_violations'`);
    const cols = colCheck.rows.map(r => r.column_name);
    
    const hasLaw = cols.includes('law_name');
    const hasFine = cols.includes('fine_amount');
    const hasRec = cols.includes('recommendation');
    const hasMethod = cols.includes('verification_method');
    const hasExp = cols.includes('explanation');

    const res = await pool.query(`
      SELECT 
        issue_type, page_url, severity, category,
        ${hasExp ? 'explanation' : 'description as explanation'}, 
        ${hasFine ? 'fine_amount' : "'' as fine_amount"}, 
        ${hasLaw ? 'law_name' : "'GDPR' as law_name"}, 
        ${hasRec ? 'recommendation' : "'Remediation required' as recommendation"},
        ${hasMethod ? 'verification_method' : "'Static Analysis' as verification_method"}
      FROM site_violations 
      WHERE domain = $1 
      ORDER BY severity DESC, created_at DESC
    `, [domain]);

    if (res.rows.length === 0) return NextResponse.json({ error: 'Audit history not found for this target.' }, { status: 404 });

    // MANDATORY DE-DUPLICATION LAYER
    const groupedViolations: Record<string, any> = {};
    res.rows.forEach(row => {
      // Group by Issue Type and Law Name to ensure absolute de-duplication
      const law = (row.law_name || 'GDPR').trim().toUpperCase();
      const type = (row.issue_type || 'VIOLATION').trim().toUpperCase();
      const key = `${type}_${law}`;
      
      if (!groupedViolations[key]) {
        groupedViolations[key] = {
          ...row,
          affected_urls: new Set([row.page_url])
        };
      } else {
        groupedViolations[key].affected_urls.add(row.page_url);
        // Hybrid Detection: If found by different methods, upgrade to Hybrid
        if (groupedViolations[key].verification_method !== row.verification_method) {
            groupedViolations[key].verification_method = 'Hybrid Analysis';
        }
      }
    });

    // Limit to top 5 most critical violation groups for performance
    const finalViolations = Object.values(groupedViolations).slice(0, 5);
    const coreViolations = finalViolations.filter(v => v.category !== 'LEGAL_GROUNDS');
    const legalGroundsIssues = finalViolations.filter(v => v.category === 'LEGAL_GROUNDS');

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
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; background: #ffffff; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-text { font-size: 24px; font-weight: bold; color: #0f172a; }
          .title-section { margin-bottom: 30px; }
          .title { font-size: 22px; font-weight: bold; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 15px; }
          .section-title { font-size: 16px; font-weight: bold; color: #3b82f6; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .domain-badge { background: #eff6ff; color: #3b82f6; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; }
          .violation-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 25px; page-break-inside: avoid; background: #ffffff; overflow: hidden; }
          .violation-header { background: #f8fafc; padding: 15px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
          .violation-type { font-weight: bold; font-size: 14px; color: #0f172a; text-transform: uppercase; }
          .violation-body { padding: 20px; }
          .severity-badge { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 3px 8px; border-radius: 99px; display: inline-block; margin-bottom: 12px; }
          .critical { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .high { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
          .low { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
          .label { font-size: 10px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; display: block; }
          .fine { font-size: 12px; font-weight: bold; color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ef4444; }
          .resource-list { font-size: 10px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-family: 'Courier New', monospace; word-break: break-all; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; }
          .contact-link { color: #3b82f6; font-weight: bold; text-decoration: none; border-bottom: 1px solid #3b82f6; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:10px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:40px; height:40px">` : ''}
            <div class="logo-text">Humango Compliance</div>
          </div>
          <div style="text-align:right; font-size:10px; color:#64748b">
            Official Audit Intelligence Report<br>Generated: ${new Date().toLocaleDateString('en-GB')}
          </div>
        </div>

        <div class="title-section">
          <div class="title">Enterprise Compliance Assessment</div>
          <div style="margin-top:15px">Audit Target: <span class="domain-badge">${domain}</span></div>
        </div>

        <div class="section-title">Core Legal Infrastructure</div>
        ${coreViolations.map(item => `
          <div class="violation-item">
            <div class="violation-header">
              <span class="violation-type">${item.issue_type}</span>
              <span style="font-size:9px; color:#64748b">${item.verification_method}</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${item.severity}">${item.severity} Risk</span>
              
              <span class="label">Diagnostic Explanation</span>
              <div style="font-size:12px; margin-bottom:15px">${item.explanation}</div>
              
              <span class="label">Statutory Basis</span>
              <div style="font-size:11px; font-weight:bold; margin-bottom:15px; color:#0f172a">${item.law_name}</div>
              
              <span class="label">Administrative Liability (Art. 83 GDPR)</span>
              <div class="fine">${item.fine_amount || '€20,000,000 or 4% of global turnover'}</div>
              
              <span class="label">Targeted Resource(s)</span>
              <div class="resource-list">
                ${Array.from(item.affected_urls).join('<br>')}
              </div>

              <span class="label">REMEDIATION BLUEPRINT</span>
              <div style="background:#ecfdf5; border:1px solid #d1fae5; padding:15px; border-radius:8px; color:#065f46; font-size:11px">
                ${item.recommendation.replace('REMEDIATION BLUEPRINT: ', '')}
              </div>
            </div>
          </div>
        `).join('')}

        ${legalGroundsIssues.length > 0 ? `
          <div class="section-title">Processing Operations & Legal Grounds</div>
          ${legalGroundsIssues.map(item => `
            <div class="violation-item">
              <div class="violation-header">
                <span class="violation-type">${item.issue_type}</span>
                <span style="font-size:9px; color:#64748b">${item.verification_method}</span>
              </div>
              <div class="violation-body">
                <span class="severity-badge ${item.severity}">${item.severity} Risk</span>
                
                <span class="label">Purpose-to-Basis Mapping Diagnostic</span>
                <div style="font-size:12px; margin-bottom:15px">${item.explanation}</div>
                
                <span class="label">Statutory Accountability</span>
                <div style="font-size:11px; font-weight:bold; margin-bottom:15px; color:#0f172a">${item.law_name}</div>
                
                <span class="label">Administrative Liability</span>
                <div class="fine">€20,000,000 or 4% of global turnover</div>

                <span class="label">Targeted Resource(s)</span>
                <div class="resource-list">
                    ${Array.from(item.affected_urls).join('<br>')}
                </div>

                <span class="label">REMEDIATION BLUEPRINT</span>
                <div style="background:#fff7ed; border:1px solid #ffedd5; padding:15px; border-radius:8px; color:#9a3412; font-size:11px">
                  ${item.recommendation.replace('REMEDIATION BLUEPRINT: ', '')}
                </div>
              </div>
            </div>
          `).join('')}
        ` : ''}

        <div class="footer">
          <div>
            &copy; ${new Date().getFullYear()} Humango Limited • London • Policy v2.1<br>
            Verification & Legal Inquiries: <a href="mailto:abuse@humango.app" class="contact-link">abuse@humango.app</a>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" style="width:30px; opacity:0.3">` : ''}
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({ 
      executablePath: CHROME_PATH, 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });

    return new NextResponse(pdfBuffer, { 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain.replace(/\./g, '_')}.pdf` 
      } 
    });
  } catch (error: any) {
    console.error('[PDF Generation Error]', error);
    return NextResponse.json({ error: 'Failed to generate report', message: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
