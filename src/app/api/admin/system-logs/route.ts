import { NextResponse } from 'next/server';
import { getBotEvents } from '@/lib/db';

export async function GET() {
  try {
    const logs = await getBotEvents(50);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch system logs' }, { status: 500 });
  }
}
