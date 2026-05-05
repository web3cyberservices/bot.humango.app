import { NextResponse } from 'next/server';
import { getBotStatus, setBotStatus } from '@/lib/db';

export async function GET() {
  const isActive = await getBotStatus();
  return NextResponse.json({ isActive });
}

export async function POST(request: Request) {
  const { isActive } = await request.json();
  const result = await setBotStatus(isActive);
  if (result.success) {
    return NextResponse.json({ success: true, isActive });
  }
  return NextResponse.json({ success: false }, { status: 500 });
}
