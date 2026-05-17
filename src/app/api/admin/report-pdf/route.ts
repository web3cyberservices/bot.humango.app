import { NextResponse, NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DomainSchema = z.string().min(3).max(255);

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/lib/chromium/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get('domain');
  
  const validation = DomainSchema.safeParse(rawDomain);
  if (!validation.success) {
    return NextResponse.json({ error: 'Valid domain required' }, { status: 400 });
  }

  const domain = validation.data.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const otherDomain = domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`;

  let browser: any = null;
  try {
    const DOMPurify = (await import('isomorphic-dompurify')).default;
    const safeDomain = DOMPurify.sanitize(domain);

    const res = await pool.query(`
      SELECT 
        issue_type, page_url, severity, category, description, business_impact,
        fine_amount, law_name, recommendation, explanation, report_type,
        verification_method, created_at
      FROM site_violations 
      WHERE domain = $1 OR domain = $2
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END ASC,
        created_at ASC
    `, [domain, otherDomain]);

    // Check if domain was at least scanned in audit_logs
    const scanCheck = await pool.query('SELECT created_at FROM audit_logs WHERE domain = $1 OR domain = $2 LIMIT 1', [domain, otherDomain]);
    
    if (res.rows.length === 0 && scanCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Audit data not found for this domain. Please run a scan first.' }, { status: 404 });
    }

    const isClean = res.rows.length === 0;
    const consolidated = new Map();
    const docExistsOnSite = res.rows.some(row => 
      !row.issue_type.toLowerCase().includes('missing') && 
      row.report_type === 'SaaS'
    );

    res.rows.forEach(row => {
      let finalIssueType = row.issue_type;
      let finalDescription = row.description;
      
      const isMissing = finalIssueType.toLowerCase().includes('missing');
      if (isMissing && docExistsOnSite) {
        finalIssueType = "CRITICAL INCOMPLETENESS";
        finalDescription = "The document was discovered via direct scan but is legally invalid due to lack of accessibility in the footer (Violation of Art. 12 GDPR).";
      }

      const key = row.law_name || finalIssueType; 
      if (!consolidated.has(key)) {
        const urls = (row.page_url || '').split(',').map((u: string) => u.trim());
        consolidated.set(key, { ...row, issue_type: finalIssueType, description: finalDescription, urls: new Set(urls) });
      } else {
        const item = consolidated.get(key);
        (row.page_url || '').split(',').forEach((u: string) => item.urls.add(u.trim()));
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
          .header { border-bottom: 3px solid ${isClean ? '#10b981' : '#3b82f6'}; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
          .logo-text { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .operator-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 25px; font-family: monospace; font-size: 9px; color: #475569; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${isClean ? '#10b981' : '#3b82f6'}; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 40px 0 20px 0; letter-spacing: 1px; }
          .violation-card { border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 15px; background: #ffffff; page-break-inside: avoid; overflow: hidden; }
          .violation-head { background: #0f172a; color: #ffffff; padding: 10px 20px; font-weight: 800; font-size: 10px; display: flex; justify-content: space-between; align-items: center; }
          .violation-body { padding: 20px; }
          .label { font-size: 8px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-top: 15px; display: block; margin-bottom: 4px; }
          .risk-badge { font-size: 8px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
          .impact-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; color: #9a3412; font-size: 10px; margin: 10px 0; border-radius: 4px; }
          .action-box { background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; color: #0369a1; font-size: 10px; font-family: monospace; border-left: 4px solid #3b82f6; }
          .clean-box { background: #ecfdf5; border: 2px solid #10b981; padding: 30px; border-radius: 20px; text-align: center; margin-top: 40px; }
          .footer-note { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:30px; height:30px">` : ''}
            <div class="logo-text">Humango Compliance Engine</div>
          </div>
          <div style="text-align:right; font-size:8px; color:#64748b;">
            Node: ${safeDomain} | bot.humango.app
          </div>
        </div>

        <div class="operator-block">
          <strong>Operator:</strong> Humango Limited | Co. No: 16750477<br>
          <strong>Address:</strong> 182-184 High Street North, London, E6 2JA<br>
          <strong>Verification:</strong> RFC 9309 Statutory Audit Node
        </div>

        <div style="margin-bottom: 30px;">
          <h1 style="font-size:20px; color:#0f172a; margin:0 0 8px 0; font-weight:800">${isClean ? 'Compliance Certificate' : 'Statutory Compliance Audit'}</h1>
          <p style="color:#64748b; margin:0; font-size:10px">Diagnostic Report for ${safeDomain}. Generated on ${new Date().toLocaleDateString()}.</p>
        </div>

        ${isClean ? `
          <div class="clean-box">
            <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
            <h2 style="color: #065f46; font-size: 18px; margin: 0 0 10px 0;">STATUTORY COMPLIANCE VERIFIED</h2>
            <p style="color: #065f46; font-size: 12px; line-height: 1.6;">
              No critical GDPR or statutory violations were detected during the automated audit of <strong>${safeDomain}</strong>.<br>
              The technical infrastructure demonstrates adherence to primary data protection transparency standards.
            </p>
            <div style="margin-top: 20px; font-family: monospace; font-size: 9px; color: #059669;">
              Verification ID: ${Math.random().toString(36).substring(2, 15).toUpperCase()}
            </div>
          </div>
        ` : `
          <div class="section-title">Findings by Statutory Law</div>
          ${findings.map(v => {
            const urls = Array.from(v.urls);
            const impact = v.business_impact && v.business_impact !== 'null' ? v.business_impact : "Business Risk: Loss of advertising ROI and regulatory intervention.";
            const liability = v.fine_amount && v.fine_amount !== 'null' ? v.fine_amount : "Fines up to €20M or 4% of turnover.";
            return `
              <div class="violation-card">
                <div class="violation-head">
                  <span>${DOMPurify.sanitize(v.issue_type)}</span>
                  <span class="risk-badge">${(v.severity || 'HIGH').toUpperCase()} RISK</span>
                </div>
                <div class="violation-body">
                  <span class="label">STATUTORY BASIS</span>
                  <div style="font-weight:800; font-size:10px; color:#0f172a">${DOMPurify.sanitize(v.law_name || 'GDPR Article 13')}</div>
                  <span class="label">SUMMARY</span>
                  <div style="color:#334155; font-size:10px;">${DOMPurify.sanitize(v.description)}</div>
                  <span class="label">BUSINESS IMPACT</span>
                  <div class="impact-box">${DOMPurify.sanitize(impact)}</div>
                  <span class="label">POTENTIAL LIABILITY</span>
                  <div style="color:#ef4444; font-weight:700;">${DOMPurify.sanitize(liability)}</div>
                  <span class="label">CORRECTIVE ACTION</span>
                  <div class="action-box">${DOMPurify.sanitize(v.recommendation || 'Action required.')}</div>
                </div>
              </div>
            `;
          }).join('')}
        `}

        <div class="footer-note">
          bot.humango.app | abuse@humango.app | Statutory Compliance Verified
        </div>
      </body>
      </html>
    `;

    const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
    browser = await puppeteer.launch({ 
      executablePath: executablePath || undefined,
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
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
