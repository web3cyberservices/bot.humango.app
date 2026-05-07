
'use server';

import { runCrawlTask } from '@/lib/crawler/crawler';
import { revalidatePath } from 'next/cache';

export async function startCrawlAction(url: string) {
  // This server action triggers the crawler logic
  const result = await runCrawlTask(url);
  
  // Принудительное обновление кэша для админ-панели
  revalidatePath('/admin');
  
  return result;
}
