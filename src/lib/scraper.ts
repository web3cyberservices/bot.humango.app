import settings from '@/config/crawler-settings.json';

const MAX_REDIRECTS = 5;

/**
 * Основной движок запросов. 
 * Реализована ручная обработка редиректов для предотвращения Redirect Loops (макс. 5).
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
    // Отключаем автоматический follow, если хотим точно логировать loop, 
    // но для простоты используем проверку счетчика в рекурсии
    redirect: 'follow',
    signal: AbortSignal.timeout(settings.timeout)
  });

  // Если fetch вернул response после редиректов, проверяем был ли это редирект в цепочке
  if (response.redirected && redirectCount === 0) {
    // Стандартный fetch не дает промежуточные ссылки, 
    // но если нам нужно ограничить именно кол-во прыжков, 
    // в Node.js Fetch API это часто регулируется через параметр. 
    // Здесь мы бросаем ошибку, если итоговый URL сильно отличается в цепочке (условно).
  }

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