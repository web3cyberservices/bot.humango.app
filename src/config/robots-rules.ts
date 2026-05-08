
import robotsParser from 'robots-parser';
import settings from '@/config/crawler-settings.json';

/**
 * Логика проверки разрешений robots.txt на основе стандартов RFC 9309.
 * Использует библиотеку robots-parser для корректной интерпретации правил.
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
      // Если robots.txt недоступен (404), RFC 9309 предписывает считать доступ разрешенным
      console.log(`[Robots] No robots.txt found for ${targetUrl.hostname}, assuming allowed.`);
    }

    const robots = robotsParser(robotsUrl, robotsTxt);
    const allowed = robots.isAllowed(urlStr, settings.userAgent) ?? true;
    const crawlDelay = robots.getCrawlDelay(settings.userAgent);

    if (!allowed) {
      return { 
        allowed: false, 
        reason: 'Forbidden by robots.txt directives (RFC 9309 compliance)' 
      };
    }

    // Дополнительная проверка на наши внутренние запрещенные пути
    const internalBlocked = ['/admin', '/private', '/config', '/api/internal', '/login'];
    if (internalBlocked.some(path => targetUrl.pathname.startsWith(path))) {
      return { allowed: false, reason: 'Internal protected path' };
    }

    return { 
      allowed: true, 
      delay: crawlDelay ? crawlDelay * 1000 : settings.scanIntervalMs 
    };
  } catch (e) {
    return { allowed: false, reason: 'Invalid URL or network error during robots.txt check' };
  }
}

export function getCrawlDelay(): number {
  return settings.scanIntervalMs / 1000 || 5;
}
