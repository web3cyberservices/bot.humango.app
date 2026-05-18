
import { NextResponse, NextRequest } from 'next/server';
import { generatePdfReport } from '@/lib/report-generator';
import { pool } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DomainSchema = z.string().min(3).max(255);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get('domain');
  
  const validation = DomainSchema.safeParse(rawDomain);
  if (!validation.success) {
    return NextResponse.json({ error: 'Valid domain required' }, { status: 400 });
  }

  // Normalize domain: strip protocol, paths, and lowercase it
  const domain = validation.data
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]; // Remove port if present

  try {
    // 1. Check if the audit exists and is completed
    const queueCheck = await pool.query(
      "SELECT status FROM public.scan_queue WHERE url ILIKE $1",
      [`%${domain}%`]
    );

    if (queueCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Audit not requested for this domain.' }, { status: 404 });
    }

    // 2. Fetch all violations for this domain
    const violationsRes = await pool.query(
      "SELECT issue_type, category, severity, description, law_name, recommendation FROM public.site_violations WHERE domain = $1",
      [domain]
    );

    const findings = violationsRes.rows;

    // 3. Generate PDF (it will show 'Compliant' if findings is empty)
    const pdfBuffer = await generatePdfReport(domain, findings);
    
    if (!pdfBuffer) {
      return NextResponse.json({ error: 'Failed to generate PDF. System engine error.' }, { status: 500 });
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
    return NextResponse.json({ error: 'Internal server error during report generation.' }, { status: 500 });
  }
}
