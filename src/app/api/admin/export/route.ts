import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT 
        domain,
        page_url, 
        issue_type, 
        severity, 
        created_at,
        fine_amount, 
        law_name,
        explanation
      FROM site_violations 
      ORDER BY created_at DESC
    `);
    
    const headers = [
      "Domain",
      "Violation Link", 
      "Type", 
      "Risk Level", 
      "Detection Date",
      "Potential Fine", 
      "Legal Foundation",
      "Description"
    ];

    const rows = res.rows.map(r => {
      const date = new Date(r.created_at).toLocaleDateString();
      return [
        `"${r.domain || ''}"`,
        `"${r.page_url || ''}"`,
        `"${r.issue_type || ''}"`,
        `"${r.severity || ''}"`,
        `"${date}"`,
        `"${r.fine_amount || ''}"`,
        `"${(r.law_name || '').replace(/"/g, '""')}"`,
        `"${(r.explanation || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=Humango_Full_Audit_${new Date().toISOString().split('T')[0]}.csv`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('[Export API Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate CSV export' }, { status: 500 });
  }
}
