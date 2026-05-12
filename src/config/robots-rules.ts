
import robotsParser from 'robots-parser';
import settings from '@/config/crawler-settings.json';

/**
 * Logic for robots.txt adherence.
 */
export async function isUrlAllowed(urlStr: string): Promise<{allowed: boolean, reason?: string, delay?: number}> {
  try {
    const targetUrl = new URL(urlStr);
    const robotsUrl = `${targetUrl.protocol}//${targetUrl.hostname}/robots.txt`;
    
    let robotsTxt = '';
    try {
      const response = await fetch(robotsUrl, { 
        headers: { 'User-Agent': settings.userAgent },
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        robotsTxt = await response.text();
      }
    } catch (e) {
      // Standard behavior: allow if unreachable
    }

    const robots = robotsParser(robotsUrl, robotsTxt);
    const allowed = robots.isAllowed(urlStr, settings.userAgent) ?? true;
    const crawlDelay = robots.getCrawlDelay(settings.userAgent);

    if (!allowed) {
      return { 
        allowed: false, 
        reason: 'Forbidden by robots.txt directives' 
      };
    }

    const internalBlocked = ['/admin', '/private', '/config', '/api/internal', '/login'];
    if (internalBlocked.some(path => targetUrl.pathname.startsWith(path))) {
      return { allowed: false, reason: 'Internal protected path' };
    }

    return { 
      allowed: true, 
      delay: crawlDelay ? crawlDelay * 1000 : settings.scanIntervalMs 
    };
  } catch (e) {
    return { allowed: false, reason: 'Invalid URL or network error' };
  }
}

export function getCrawlDelay(): number {
  return settings.scanIntervalMs / 1000 || 5;
}
