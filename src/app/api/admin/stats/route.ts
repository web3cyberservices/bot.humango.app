
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Return stable mock stats to ensure frontend works while engine is processing
    return NextResponse.json({
      pagesScanned: 1240,
      issuesFound: 86,
      recentIssues: []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal system error' }, { status: 500 });
  }
}
