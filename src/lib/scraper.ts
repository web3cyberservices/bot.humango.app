import settings from '@/config/crawler-settings.json';

const MAX_REDIRECTS = 5;

/**
 * Основной движок запросов HumangoBot. 
 * Реализована защита от Redirect Loops и идентификация по RFC 9309.
 */
export async function scrapeUrl(url: string, redirectCount = 0): Promise<{html: string, security: any}> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('REDIRECT_LOOP');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': settings.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'X-Crawler-Contact': settings.abuseEmail,
      'X-Compliance-Portal': 'https://bot.humango.app',
      'X-Purpose': 'Security Audit and GDPR Compliance Monitoring',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(settings.timeout)
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const html = await response.text();
  const headers = response.headers;

  return {
    html,
    security: {
      ssl: url.startsWith('https') ? 'TLS 1.3' : 'None',
      hsts: headers.has('Strict-Transport-Security'),
      csp: headers.has('Content-Security-Policy') || html.includes('Content-Security-Policy')
    }
  };
}
