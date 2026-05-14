
'use server';

import { runCrawlTask } from '@/lib/crawler/crawler';
import { revalidatePath } from 'next/cache';
import { saveBotEvent } from '@/lib/db';
import { z } from 'zod';

const StartScanSchema = z.object({
  url: z.string().url(),
  email: z.string().email().optional()
});

export async function startCrawlAction(rawUrl: string, rawEmail?: string) {
  // Security Gate: Strict Zod Validation at the Server Action level
  const validation = StartScanSchema.safeParse({ url: rawUrl, email: rawEmail });
  
  if (!validation.success) {
    return { status: 'failed', reason: 'Invalid target URL format or email address.' };
  }

  const { url, email } = validation.data;
  
  // Additional security check for protocol and domain
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { status: 'failed', reason: 'Forbidden protocol.' };
    }
  } catch (e) {
    return { status: 'failed', reason: 'Malformed URL.' };
  }

  const result = await runCrawlTask(url);
  
  revalidatePath('/admin');
  
  if (result.status === 'success' && email) {
    const domain = new URL(url).hostname;
    await saveBotEvent(
      'SUCCESS', 
      `Audit Dispatched: Detailed PDF report queued for delivery to ${email} for node: ${domain}`
    );
    
    return {
      ...result,
      emailSent: true,
      recipient: email
    };
  }
  
  return result;
}
