
import * as cheerio from 'cheerio';
import { Violation } from '@/types';

/**
 * Определяет правовую информацию на основе доменной зоны.
 */
function getLawContext(domain: string) {
  const d = domain.toLowerCase();
  if (d.endsWith('.de')) {
    return {
      law: 'BDSG (Германия) & GDPR',
      fine: 'до €20 млн или 4% годового оборота',
      region: 'DE'
    };
  }
  if (d.endsWith('.fr')) {
    return {
      law: 'LIL (Франция) & GDPR',
      fine: 'до €20 млн',
      region: 'FR'
    };
  }
  if (d.endsWith('.it')) {
    return {
      law: 'Codice della Privacy (Италия)',
      fine: 'до €20 млн',
      region: 'IT'
    };
  }
  return {
    law: 'EU GDPR',
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
 * Экспертный парсер с региональной логикой.
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
      if (EU_TLDS.some(tld => hostname.endsWith(tld)) && hostname !== domain) {
        discoveredLinks.push(absoluteUrl.href);
      }
    } catch (e) {}
  });

  // 1. Google Fonts Check (IP Leakage)
  if (html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com')) {
    violations.push({
      category: 'Privacy',
      issue_type: 'Нарушение конфиденциальности (передача IP без согласия)',
      severity: 'high',
      evidence_html: 'External request to fonts.googleapis.com',
      snippet: 'Link to Google Fonts detected in HTML source.',
      description: 'Dynamic loading of Google Fonts from remote servers.',
      law_name: lawContext.law,
      potential_fine: lawContext.fine,
      explanation: 'Использование Google Fonts без локального хостинга приводит к автоматической передаче IP-адреса пользователя на серверы Google (США) без предварительного явного согласия. Это признано нарушением GDPR судом Мюнхена (Case: 3 O 17493/20).',
      recommendation: 'Хостите шрифты локально на своем сервере.'
    });
  }

  // 2. Cookie Banner Check (ePrivacy)
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
      law_name: lawContext.law,
      potential_fine: lawContext.fine,
      explanation: 'Отсутствие баннера согласия нарушает ePrivacy Directive и требования GDPR о получении явного согласия перед установкой любых не строго необходимых файлов cookie.',
      recommendation: 'Установите платформу управления согласием (CMP), например Cookiebot или OneTrust.'
    });
  }

  // 3. Impressum Check (Only for .de)
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
        snippet: 'A-tags search: no impressum-related labels or paths found.',
        description: 'Missing mandatory legal disclosure (Impressum).',
        law_name: 'Telemediengesetz (TMG) & BDSG',
        potential_fine: 'до €50 000',
        explanation: 'Немецкие сайты обязаны иметь легкодоступную юридическую информацию (Impressum) согласно § 5 TMG. Отсутствие ссылки в футере — основание для судебного иска (Abmahnung).',
        recommendation: 'Добавьте ссылку "Impressum" в главное меню или футер сайта.'
      });
    }
  }

  // 4. Unsecure Protocol Check
  if (url.startsWith('http://')) {
    violations.push({
      category: 'Security',
      issue_type: 'Unsecure Data Transmission',
      severity: 'critical',
      evidence_html: 'Protocol: HTTP',
      snippet: 'Scheme: http (non-encrypted)',
      description: 'Lack of TLS encryption.',
      law_name: lawContext.law,
      potential_fine: lawContext.fine,
      explanation: 'Использование протокола HTTP вместо HTTPS нарушает ст. 32 GDPR (Security of processing), так как данные пользователей передаются в открытом виде.',
      recommendation: 'Настройте SSL-сертификат и принудительный редирект на HTTPS.'
    });
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 50) 
  };
}
