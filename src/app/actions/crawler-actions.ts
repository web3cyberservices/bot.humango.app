
'use server';

import { queueTask, getTaskStatus } from '@/lib/db';
import { z } from 'zod';

const StartScanSchema = z.object({
  url: z.string().url(),
  email: z.string().email()
});

export async function startCrawlAction(rawUrl: string, rawEmail: string) {
  const validation = StartScanSchema.safeParse({ url: rawUrl, email: rawEmail });
  if (!validation.success) {
    return { status: 'failed', reason: 'Invalid target URL format or email address.' };
  }

  const { url, email } = validation.data;
  
  try {
    const cleanUrl = await queueTask(url, email, 10); // Priority 10 for user requests
    return { 
      status: 'success', 
      url: cleanUrl,
      message: 'Audit added to priority queue. Bot is processing...' 
    };
  } catch (e: any) {
    return { status: 'failed', reason: e.message };
  }
}

export async function checkAuditStatus(url: string) {
  try {
    const status = await getTaskStatus(url);
    return { success: true, status: status?.status || 'unknown' };
  } catch (e) {
    return { success: false };
  }
}
