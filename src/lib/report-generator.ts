
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

async function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

interface Finding {
  type?: string;
  basis?: string;
  summary: string;
  description: string;
  liability: string;
  action?: string;
  recommendation?: string;
}

export async function generatePdfReport(domain: string, findings: Finding[] = []): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const safeDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    let logoBase64 = '';
    
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 50px; background: #fff; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 30px; margin-bottom: 40px; }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-img { width: 48px; height: 48px; object-fit: contain; }
          .logo-text { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
          .logo-text span { color: #3b82f6; }
          .company-details { text-align: right; font-size: 11px; color: #0f172a; font-weight: 500; }
          .company-details a { color: #3b82f6; text-decoration: none; font-weight: 800; }
          .report-meta { margin-bottom: 40px; border-left: 4px solid #3b82f6; padding-left: 20px; }
          .report-title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; }
          .target-info { font-size: 14px; color: #3b82f6; margin-top: 8px; font-family: monospace; font-weight: 700; }
          .finding-card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; margin-bottom: 25px; page-break-inside: avoid; background: #f8fafc; }
          .type-label { font-weight: 800; text-transform: uppercase; font-size: 13px; color: #0f172a; margin-bottom: 10px; display: block; }
          .severity-badge { float: right; font-size: 10px; padding: 4px 12px; border-radius: 99px; background: #fee2e2; color: #dc2626; font-weight: 800; }
          .desc-text { font-size: 14px; color: #334155; margin-bottom: 15px; }
          .liability-box { background: #fff1f2; padding: 15px; border-radius: 10px; border: 1px solid #fecaca; margin-bottom: 15px; }
          .liability-text { color: #be123c; font-size: 14px; font-weight: 800; }
          .recommendation-box { background: #eff6ff; padding: 20px; border-radius: 10px; font-size: 13px; border-left: 5px solid #3b82f6; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<div style="width:40px;height:40px;background:#3b82f6;border-radius:8px;"></div>`}
            <div class="logo-text">Humango<span>Compliance</span></div>
          </div>
          <div class="company-details">
            <strong>Humango Limited</strong> | UK Co. No: 16750477<br>
            182-184 High Street North, London, E6 2JA<br>
            <a href="mailto:abuse@humango.app">abuse@humango.app</a>
          </div>
        </div>
        <div class="report-meta">
          <h1 class="report-title">Statutory Audit Report</h1>
          <div class="target-info">TARGET: ${safeDomain.toUpperCase()} | DATE: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
        ${findings.length === 0 ? `
          <div style="text-align:center; padding: 100px; border: 4px dashed #10b981; border-radius: 30px; background: #f0fdf4;">
            <h2 style="color:#065f46; font-size: 28px; font-weight: 900;">STATUTORY COMPLIANCE VERIFIED</h2>
          </div>
        ` : findings.map(f => `
          <div class="finding-card">
            <span class="severity-badge">CRITICAL RISK</span>
            <span class="type-label">${(f.type || 'Violation').replace(/_/g, ' ')}</span>
            <div class="desc-text">${f.description || f.summary}</div>
            <div class="liability-box">
              <div style="font-size:10px; text-transform:uppercase; color:#be123c; font-weight:800;">Statutory Liability</div>
              <div class="liability-text">${f.liability}</div>
            </div>
            <div class="recommendation-box">
              <div style="font-size:10px; text-transform:uppercase; color:#3b82f6; font-weight:800;">Required Action</div>
              <div style="font-weight:700; color:#1e3a8a;">${f.recommendation || f.action}</div>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const executablePath = await getExecutablePath();
    browser = await puppeteer.launch({ 
      executablePath, 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } catch (error) { 
    console.error('[PDF Error]', error); 
    return null; 
  } finally { 
    if (browser) await browser.close(); 
  }
}
