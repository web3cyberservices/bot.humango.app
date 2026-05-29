
import { NextResponse, NextRequest } from 'next/server';
import { generatePdfReport } from '@/lib/report-generator';
import { pool } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DomainSchema = z.string().min(3);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get('domain');
  
  const validation = DomainSchema.safeParse(rawDomain);
  if (!validation.success) {
    return NextResponse.json({ error: 'Valid domain required' }, { status: 400 });
  }

  const domain = validation.data
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0];

  try {
    // We now fetch the audit findings directly from the scan_queue table
    // as it's the primary source of truth for the latest scans.
    const taskRes = await pool.query(
      `SELECT audit_findings FROM public.scan_queue 
       WHERE url LIKE $1 OR url LIKE $2
       ORDER BY updated_at DESC LIMIT 1`,
      [`%${domain}%`, `%${domain.replace('www.', '')}%`]
    );

    let findings = [];
    if (taskRes.rows.length > 0 && taskRes.rows[0].audit_findings) {
      findings = taskRes.rows[0].audit_findings;
    }

    const pdfBuffer = await generatePdfReport(domain, findings);
    
    if (!pdfBuffer) {
      return NextResponse.json({ error: 'PDF Generation Failed' }, { status: 500 });
    }

    return new NextResponse(pdfBuffer, { 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename=Humango_Audit_${domain}.pdf`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      } 
    });
  } catch (error: any) {
    console.error('[PDF API ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
