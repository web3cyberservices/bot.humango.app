
import { NextResponse } from 'next/server';
import { getViolations } from '@/lib/db';

export async function GET() {
  try {
    // getViolations уже содержит ORDER BY created_at DESC согласно логике в db.ts
    const violations = await getViolations(100);
    return NextResponse.json({ 
      success: true, 
      violations,
      _timestamp: new Date().toISOString() // Для предотвращения агрессивного кэширования браузером
    });
  } catch (error) {
    console.error('[API Violations Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch violations' }, { status: 500 });
  }
}
