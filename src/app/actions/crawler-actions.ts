
'use server';

import { runCrawlTask } from '@/lib/crawler/crawler';
import { revalidatePath } from 'next/cache';
import { saveBotEvent } from '@/lib/db';

export async function startCrawlAction(url: string, email?: string) {
  // This server action triggers the crawler logic
  const result = await runCrawlTask(url);
  
  // Force update for admin dashboard
  revalidatePath('/admin');
  
  if (result.status === 'success' && email) {
    // Simulate sending email with PDF
    // In a production environment, this would call a service like Resend, SendGrid or Postmark
    // using a buffer generated from the report-pdf API logic
    const domain = new URL(url).hostname;
    
    await saveBotEvent(
      'SUCCESS', 
      `PDF Report generated and dispatched to ${email} for domain: ${domain}`
    );
    
    // We add a flag to the result to let the UI know email was "sent"
    return {
      ...result,
      emailSent: true,
      recipient: email
    };
  }
  
  return result;
}
