
import { NextResponse } from 'next/server';
import { getBotStatus, setBotStatus, saveBotEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isActive = await getBotStatus();
  return NextResponse.json({ isActive });
}

export async function POST(request: Request) {
  const { isActive } = await request.json();
  const result = await setBotStatus(isActive);
  
  if (result.success) {
    await saveBotEvent(
      isActive ? 'START' : 'STOP', 
      `Движок переведен в состояние ${isActive ? 'АКТИВЕН' : 'ПАУЗА'} через админ-панель.`
    );
    return NextResponse.json({ success: true, isActive });
  }
  
  return NextResponse.json({ success: false }, { status: 500 });
}
