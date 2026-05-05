import * as cheerio from 'cheerio';

export interface ScanIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  category: 'GDPR' | 'Security' | 'Privacy';
}

/**
 * Парсер сфокусирован исключительно на техническом аудите.
 * Мы НЕ извлекаем персональные данные (email, имена, телефоны).
 */
export function parseContent(html: string, url: string): ScanIssue[] {
  const $ = cheerio.load(html);
  const issues: ScanIssue[] = [];

  // 1. Проверка на SSL/HTTPS формы (GDPR Privacy Rule)
  // Отправка данных через HTTP — критическое нарушение GDPR
  $('form').each((_, el) => {
    const action = $(el).attr('action') || '';
    if (!action.startsWith('https') && !url.startsWith('https:')) {
      issues.push({
        type: 'UNSECURE_DATA_TRANSMISSION',
        category: 'GDPR',
        severity: 'critical',
        description: 'Sensitive form found transmitting data over unencrypted HTTP.'
      });
    }
  });

  // 2. Проверка заголовков безопасности (Technical Audit)
  // Мы ищем отсутствие защиты от XSS или Clickjacking
  if (!html.includes('Content-Security-Policy') && !html.includes('X-Frame-Options')) {
    issues.push({
      type: 'MISSING_SECURITY_HEADERS',
      category: 'Security',
      severity: 'medium',
      description: 'The site is missing basic security headers (CSP or X-Frame-Options).'
    });
  }

  // 3. Проверка на устаревшие технологии
  if (html.includes('vulnerable-library.js')) {
    issues.push({
      type: 'OUTDATED_SOFTWARE',
      category: 'Security',
      severity: 'high',
      description: 'Detected a library with known vulnerabilities.'
    });
  }

  return issues;
}
