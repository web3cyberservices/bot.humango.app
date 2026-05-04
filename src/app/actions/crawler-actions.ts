
'use server';

import { runCrawlTask } from '@/lib/crawler/crawler';

export async function startCrawlAction(url: string) {
  // This server action triggers the crawler logic
  const result = await runCrawlTask(url);
  return result;
}
