
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
        issue_type, page_url, severity, category, explanation, 
        fine_amount, law_name, recommendation, verification_method, description
      FROM site_violations 
      WHERE domain = $1 
      ORDER BY severity DESC, created_at DESC
    `, [domain]);

    if (res.rows.length === 0) return NextResponse.json({ error: 'Audit history not found for this target.' }, { status: 404 });

    // ULTIMATE CONSOLIDATION ENGINE (HARD MERGE)
    const consolidated: Record<string, any> = {};
    
    res.rows.forEach(row => {
      const cat = (row.category || 'GENERAL').trim().toUpperCase();
      const law = (row.law_name || 'GDPR').trim().toUpperCase();
      const key = `${cat}_${law}`;

      if (!consolidated[key]) {
        // Handle Section I specific text if it's Art. 13(1)(a)
        let displayDescription = row.explanation;
        if (law.includes('13(1)(A)')) {
          displayDescription = "The automated scan performed a semantic and structural analysis of the website's legal documents and metadata. The system failed to identify the official legal name of the data controller, a registered physical address, or a specific registration number. Under Art. 13(1)(a), this information is mandatory for establishing accountability.";
        }

        consolidated[key] = {
          category: cat,
          law_name: law,
          severity: row.severity,
          issue_type: row.issue_type,
          diagnostic_description: displayDescription,
          recommendation: row.recommendation,
          affected_urls: new Set([row.page_url]),
          methods: new Set([row.verification_method])
        };
      } else {
        consolidated[key].affected_urls.add(row.page_url);
        consolidated[key].methods.add(row.verification_method);
        
        // Keep highest severity
        const levels: Record<string, number> = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        if (levels[row.severity.toLowerCase()] > levels[consolidated[key].severity.toLowerCase()]) {
          consolidated[key].severity = row.severity;
        }
      }
    });

    const sections = Object.values(consolidated).map(s => {
      const methods = Array.from(s.methods);
      s.display_method = methods.length > 1 ? 'Hybrid (Dynamic + Static)' : methods[0];
      s.url_list = Array.from(s.affected_urls);
      return s;
    });

    // CATEGORY FILTERING FOR FIXED 4-PAGE STRUCTURE
    const coreLegal = sections.filter(s => s.category === 'PRIVACY' && (s.law_name.includes('13(1)(A)') || s.law_name.includes('IMPRESSUM')));
    const processingAudit = sections.filter(s => s.category === 'LEGAL_GROUNDS' || s.law_name.includes('13(1)(C)'));
    const transparencyFramework = sections.filter(s => s.category === 'PRIVACY' && (s.law_name.includes('13(2)') || s.law_name.includes('13(1)(B)')));
    const technicalRisks = sections.filter(s => s.category === 'SECURITY' || s.category === 'TECHNICAL');

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
          body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 20px; line-height: 1.4; background: #ffffff; font-size: 10px; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-text { font-size: 18px; font-weight: bold; color: #0f172a; }
          .title-section { margin-bottom: 15px; }
          .title { font-size: 16px; font-weight: bold; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 10px; }
          .domain-badge { background: #eff6ff; color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
          
          .page-break { page-break-after: always; }
          .section-header { background: #0f172a; color: #ffffff; padding: 8px 15px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 20px; margin-bottom: 10px; border-radius: 4px; }
          
          .violation-card { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px; background: #ffffff; overflow: hidden; }
          .violation-head { background: #f8fafc; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
          .violation-title { font-weight: bold; font-size: 10px; color: #0f172a; }
          .violation-body { padding: 12px; }
          
          .severity-badge { font-size: 7px; font-weight: bold; text-transform: uppercase; padding: 2px 6px; border-radius: 99px; display: inline-block; margin-bottom: 8px; }
          .CRITICAL { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .HIGH { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
          .MEDIUM { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
          
          .label { font-size: 8px; font-weight: bold; color: #3b82f6; text-transform: uppercase; margin-bottom: 4px; display: block; margin-top: 10px; letter-spacing: 0.5px; }
          .fine-box { font-size: 9px; font-weight: bold; color: #ef4444; background: #fef2f2; padding: 6px; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid #ef4444; }
          .url-list { font-size: 7px; color: #64748b; background: #f8fafc; padding: 8px; border-radius: 4px; font-family: 'Courier New', monospace; list-style: none; margin: 5px 0 10px 0; }
          .url-list li { margin-bottom: 2px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
          
          .blueprint-box { background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px; border-radius: 4px; color: #0369a1; font-size: 9px; font-weight: 500; margin-top: 5px; line-height: 1.5; }
          .footer { position: fixed; bottom: 20px; left: 20px; right: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 7px; color: #94a3b8; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { text-align: left; background: #f1f5f9; padding: 8px; font-size: 8px; border: 1px solid #e2e8f0; color: #475569; }
          td { padding: 8px; border: 1px solid #e2e8f0; font-size: 8px; vertical-align: top; }
        </style>
      </head>
      <body>
        <!-- Page 1: COVER & CORE LEGAL -->
        <div class="header">
          <div style="display:flex; align-items:center; gap:8px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:25px; height:25px">` : ''}
            <div class="logo-text">Humango Compliance</div>
          </div>
          <div style="text-align:right; font-size:7px; color:#64748b">
            Enterprise Audit v2.9<br>Target: ${domain}
          </div>
        </div>

        <div class="title-section">
          <div class="title">Statutory Compliance Assessment</div>
          <div style="margin-top:5px">Validated Endpoint: <span class="domain-badge">${domain}</span></div>
        </div>

        <div class="section-header">I. Core Legal Infrastructure (Art. 13(1)(a))</div>
        ${coreLegal.map(s => `
          <div class="violation-card">
            <div class="violation-head">
              <span class="violation-title">${s.issue_type}</span>
              <span style="font-size:7px; color:#64748b">${s.display_method}</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${s.severity.toUpperCase()}">${s.severity} RISK</span>
              <div class="fine-box">Administrative Liability: €20,000,000 or 4% of global turnover</div>
              
              <span class="label">Legal Basis & Status</span>
              <div style="font-weight:bold; margin-bottom:5px">${s.law_name}</div>
              
              <span class="label">DIAGNOSTIC DESCRIPTION</span>
              <div style="margin-bottom:10px; color: #334155;">${s.diagnostic_description}</div>

              <span class="label">Targeted Resource(s)</span>
              <ul class="url-list">
                ${s.url_list.map((u:string) => `<li>${u}</li>`).join('')}
              </ul>

              <span class="label">REMEDIATION BLUEPRINT</span>
              <div class="blueprint-box">${s.recommendation}</div>
            </div>
          </div>
        `).join('')}
        <div class="page-break"></div>

        <!-- Page 2: PROCESSING AUDIT -->
        <div class="section-header">II. Audit of Processing Operations (Art. 13(1)(c))</div>
        <div class="violation-card">
          <div class="violation-head">
            <span class="violation-title">PURPOSE-TO-BASIS CORRELATION TABLE</span>
            <span style="font-size:7px; color:#64748b">Semantic Audit</span>
          </div>
          <div class="violation-body">
            <span class="severity-badge CRITICAL">CRITICAL RISK</span>
            <div class="fine-box">Administrative Liability: €20,000,000 or 4% of global turnover</div>

            <span class="label">Legal Basis & Status</span>
            <div style="font-weight:bold; margin-bottom:5px">Article 13(1)(c) GDPR</div>

            <span class="label">DIAGNOSTIC DESCRIPTION</span>
            <div style="margin-bottom:12px; color: #334155;">
              The audit identified specific processing operations active on <b>${domain}</b>. Art. 13(1)(c) mandates that the controller must disclose both the purposes of processing and the statutory legal basis (Art. 6) for each activity. The following activities were found to be missing the required explicit legal basis correlation.
            </div>

            <table>
              <thead>
                <tr>
                  <th>Detected Activity</th>
                  <th>Legal Basis (Art. 6)</th>
                  <th>Current Status</th>
                  <th>Required Remediation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Usage Analysis / Analytics</td>
                  <td>Not Explicitly Linked</td>
                  <td style="color:#ef4444; font-weight:bold;">NON-COMPLIANT</td>
                  <td>Link to Art. 6(1)(f) (Legitimate Interests) or 6(1)(a)</td>
                </tr>
                <tr>
                  <td>Fraud Prevention / Security</td>
                  <td>Not Explicitly Linked</td>
                  <td style="color:#ef4444; font-weight:bold;">NON-COMPLIANT</td>
                  <td>Explicitly link to Art. 6(1)(f) (Legitimate Interests)</td>
                </tr>
                <tr>
                  <td>Marketing / Remarketing</td>
                  <td>Missing Statutory Link</td>
                  <td style="color:#ef4444; font-weight:bold;">NON-COMPLIANT</td>
                  <td>Establish affirmative Consent framework per Art. 7</td>
                </tr>
              </tbody>
            </table>
            
            <span class="label">REMEDIATION BLUEPRINT</span>
            <div class="blueprint-box">
              Update the Privacy Policy text to include a dedicated transparency table where every detected processing activity (Analytics, Support, Security) is explicitly mapped to a specific sub-section of Article 6 GDPR.
            </div>
          </div>
        </div>
        <div class="page-break"></div>

        <!-- Page 3: TRANSPARENCY FRAMEWORK -->
        <div class="section-header">III. Transparency Framework Cluster (Art. 13(2))</div>
        ${transparencyFramework.length > 0 ? transparencyFramework.map(s => `
          <div class="violation-card">
            <div class="violation-head">
              <span class="violation-title">MANDATORY DISCLOSURE CLUSTER</span>
              <span style="font-size:7px; color:#64748b">Structural Validation</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${s.severity.toUpperCase()}">${s.severity} RISK</span>
              <div class="fine-box">Administrative Liability: €20,000,000 or 4% of global turnover</div>
              
              <span class="label">Legal Basis & Status</span>
              <div style="font-weight:bold; margin-bottom:5px">${s.law_name}</div>

              <span class="label">DIAGNOSTIC DESCRIPTION</span>
              <div style="margin-bottom:10px; color: #334155;">${s.diagnostic_description}</div>

              <span class="label">Targeted Resource(s)</span>
              <ul class="url-list">
                ${s.url_list.map((u:string) => `<li>${u}</li>`).join('')}
              </ul>

              <span class="label">REMEDIATION BLUEPRINT</span>
              <div class="blueprint-box">${s.recommendation}</div>
            </div>
          </div>
        `).join('') : `
          <div class="violation-card">
            <div class="violation-body" style="text-align:center; padding: 40px;">
              <p style="color:#64748b;">No secondary Transparency Framework violations detected for this domain.</p>
            </div>
          </div>
        `}
        <div class="page-break"></div>

        <!-- Page 4: TECHNICAL RISKS -->
        <div class="section-header">IV. Technical Audit Findings</div>
        ${technicalRisks.map(s => `
          <div class="violation-card">
            <div class="violation-head">
              <span class="violation-title">${s.issue_type}</span>
              <span style="font-size:7px; color:#64748b">Security Module</span>
            </div>
            <div class="violation-body">
              <span class="severity-badge ${s.severity.toUpperCase()}">${s.severity} RISK</span>
              
              <span class="label">Legal Basis & Status</span>
              <div style="font-weight:bold; margin-bottom:5px">${s.law_name || 'Technical Security Standard'}</div>

              <span class="label">DIAGNOSTIC DESCRIPTION</span>
              <div style="margin-bottom:10px; color: #334155;">${s.diagnostic_description}</div>
              
              <span class="label">Targeted Resource(s)</span>
              <ul class="url-list">
                ${s.url_list.map((u:string) => `<li>${u}</li>`).join('')}
              </ul>

              <span class="label">REMEDIATION BLUEPRINT</span>
              <div class="blueprint-box">${s.recommendation}</div>
            </div>
          </div>
        `).join('')}

        <div class="footer">
          <div>&copy; ${new Date().getFullYear()} Humango Compliance • Policy v2.9 • Confidential Audit</div>
          <div>Report ID: HB-${Math.random().toString(36).substring(7).toUpperCase()} • Generated: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({ 
      executable_path: CHROME_PATH, 
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
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain.replace(/\./g, '_')}.pdf` 
      } 
    });
  } catch (error: any) {
    console.error('[PDF Generation Error]', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
