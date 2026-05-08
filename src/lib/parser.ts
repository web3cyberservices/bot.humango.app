
import * as cheerio from 'cheerio';
import { Violation } from '@/types';

/**
 * Определяет правовую информацию на основе доменной зоны и региона.
 * Возвращает только контекст закона и штрафа, обоснование теперь задается точечно.
 */
function getLawContext(domain: string) {
  const d = domain.toLowerCase();
  
  if (d.endsWith('.de')) {
    return {
      law: 'BITV 2.0 / GDPR',
      fine: 'до €50,000 (адм. штраф) или до 4% оборота',
      region: 'DE'
    };
  }
  
  if (d.endsWith('.fr')) {
    return {
      law: 'RGAA',
      fine: 'до €25,000 (адм. штраф) или до 4% оборота',
      region: 'FR'
    };
  }

  if (d.endsWith('.it')) {
    return {
      law: 'Stanca Act / GDPR',
      fine: 'до 5% оборота или до €20 млн',
      region: 'IT'
    };
  }

  if (d.endsWith('.us') || d.endsWith('.gov')) {
    return {
      law: 'ADA / Section 508',
      fine: '$4,000 - $75,000+',
      region: 'US'
    };
  }

  return {
    law: 'EU GDPR / EN 301 549',
    fine: 'до €20 млн или 4% годового оборота',
    region: 'EU'
  };
}

/**
 * Эвристика глубокого сканирования.
 */
export function shouldRunDeepScan(html: string): boolean {
  const indicators = [
    'react.js', 'vue.js', '_next/static', 'gtm.js', 'fbevents.js', 
    'adsbygoogle', 'intercom', 'crisp.chat', 'cookie-law', 'cookie-banner'
  ];
  const lowerHtml = html.toLowerCase();
  return indicators.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
}

const EU_TLDS = ['.de', '.fr', '.it', '.es', '.pl', '.nl', '.be', '.at', '.dk', '.fi', '.se', '.ie', '.pt', '.cz', '.gr', '.hu', '.ro', '.sk', '.bg', '.ee', '.lv', '.lt', '.hr', '.si', '.mt', '.cy'];

/**
 * Экспертный парсер с региональной логикой и точечными обоснованиями.
 */
export function parseHtmlContent(html: string, url: string, headers: any = {}): { violations: Violation[], discoveredLinks: string[] } {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];
  
  const currentUrl = new URL(url);
  const domain = currentUrl.hostname.toLowerCase();
  const lawContext = getLawContext(domain);

  // --- Auto-Discovery ---
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href) return;
      const absoluteUrl = new URL(href, url);
      const hostname = absoluteUrl.hostname.toLowerCase();
      const blacklist = ['google.', 'facebook.', 'amazon.', 'wikipedia.', 'linkedin.', 'twitter.', 'instagram.', 'youtube.'];
      if (blacklist.some(b => hostname.includes(b))) return;

      if (EU_TLDS.some(tld => hostname.endsWith(tld)) && hostname !== domain) {
        discoveredLinks.push(absoluteUrl.href);
      }
    } catch (e) {}
  });

  // 1. Accessibility Check: Missing ALT attributes
  $('img:not([alt])').each((_, el) => {
    const snippet = $.html(el);
    violations.push({
      category: 'ADA',
      issue_type: 'Отсутствие альтернативного текста (Accessibility)',
      severity: 'medium',
      evidence_html: snippet,
      snippet: snippet,
      description: 'Image lacks alt attribute.',
      law_name: lawContext.law,
      potential_fine: lawContext.fine,
      explanation: 'Нарушение цифровой доступности (EN 301 549 / BITV). Отсутствие атрибута alt у графического контента препятствует восприятию информации пользователями с нарушениями зрения.',
      recommendation: 'Добавьте атрибут alt к тегу <img> для корректной работы скринридеров.'
    });
  });

  // 2. Google Fonts Check (IP Leakage)
  if (html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com')) {
    violations.push({
      category: 'Privacy',
      issue_type: 'Нарушение конфиденциальности (передача IP без согласия)',
      severity: 'high',
      evidence_html: 'External request to fonts.googleapis.com',
      snippet: 'Link to Google Fonts detected in HTML source.',
      description: 'Dynamic loading of Google Fonts from remote servers.',
      law_name: 'EU GDPR',
      potential_fine: lawContext.fine,
      explanation: 'Автоматическая передача IP-адреса пользователя на серверы Google (США) без предварительного согласия нарушает требования GDPR о защите персональных данных.',
      recommendation: 'Разместите файлы шрифтов на собственном сервере.'
    });
  }

  // 3. Cookie Banner Check (ePrivacy)
  const cookieIndicators = ['cookie-banner', 'cookie-consent', 'onetrust', 'didomi', 'cookie-law', 'cookie-overlay', 'cc-window'];
  const hasBanner = cookieIndicators.some(ind => html.toLowerCase().includes(ind));
  if (!hasBanner) {
    violations.push({
      category: 'GDPR',
      issue_type: 'Нарушение ePrivacy Directive',
      severity: 'critical',
      evidence_html: 'No cookie consent element found',
      snippet: 'Body source analysis: missing common consent library indicators.',
      description: 'Missing Cookie Consent Management Platform.',
      law_name: 'ePrivacy Directive / GDPR',
      potential_fine: lawContext.fine,
      explanation: 'Нарушение регламента GDPR и ePrivacy Directive. Отсутствие баннера согласия препятствует получению явного разрешения на обработку не-технических данных пользователя.',
      recommendation: 'Установите платформу управления согласием (CMP) для блокировки куки до получения согласия.'
    });
  }

  // 4. Impressum Check
  if (domain.endsWith('.de')) {
    const hasImpressum = $('a').toArray().some(a => {
      const text = $(a).text().toLowerCase();
      const href = $(a).attr('href')?.toLowerCase() || '';
      return text.includes('impressum') || href.includes('impressum');
    });
    if (!hasImpressum) {
      violations.push({
        category: 'Privacy',
        issue_type: 'Нарушение § 5 TMG',
        severity: 'high',
        evidence_html: 'Missing link to Impressum',
        snippet: 'A-tags search: no impressum-related labels found.',
        description: 'Missing mandatory legal disclosure (Impressum).',
        law_name: 'Telemediengesetz (TMG)',
        potential_fine: 'до €50,000',
        explanation: 'Нарушение требований немецкого законодательства о прозрачности. Немецкие ресурсы обязаны иметь легкодоступный раздел Impressum.',
        recommendation: 'Разместите ссылку на Impressum в футере сайта.'
      });
    }
  }

  // 5. Unsecure Protocol Check
  if (url.startsWith('http://')) {
    violations.push({
      category: 'Security',
      issue_type: 'Unsecure Data Transmission',
      severity: 'critical',
      evidence_html: 'Protocol: HTTP',
      snippet: 'Scheme: http (non-encrypted)',
      description: 'Lack of TLS encryption.',
      law_name: 'GDPR Art. 32',
      potential_fine: lawContext.fine,
      explanation: 'Нарушение статьи 32 GDPR (Безопасность обработки). Передача данных по незашифрованному протоколу HTTP подвергает персональные данные риску перехвата.',
      recommendation: 'Настройте SSL-сертификат и принудительный редирект на HTTPS.'
    });
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 50) 
  };
}
