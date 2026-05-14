import { NextResponse } from 'next/server';
import { getBotStatus, setBotStatus, saveBotEvent } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ControlSchema = z.object({
  isActive: z.boolean(),
});

export async function GET() {
  try {
    const isActive = await getBotStatus();
    return NextResponse.json({ isActive });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ControlSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid input payload' 
      }, { status: 400 });
    }

    const { isActive } = validation.data;
    const result = await setBotStatus(isActive);
    
    if (result.success) {
      await saveBotEvent(
        isActive ? 'START' : 'STOP', 
        `System state transitioned to ${isActive ? 'ACTIVE' : 'PAUSED'} via administrative terminal.`
      );
      return NextResponse.json({ success: true, isActive });
    }
    
    return NextResponse.json({ success: false }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Request processing failed' }, { status: 500 });
  }
}
