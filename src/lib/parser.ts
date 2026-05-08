
import * as cheerio from 'cheerio';
import { Violation } from '@/types';

/**
 * Расширенная эвристика поиска юридических документов и анализа их содержимого.
 */
const LEGAL_KEYWORDS = {
  privacy: ['privacy', 'datenschutz', 'confidentialite', 'privacidad', 'confidenzialita', 'politika privatnosti'],
  cookies: ['cookie', 'cookies', 'galletas', 'biscotti'],
  terms: ['terms', 'tos', 'conditions', 'bedingungen', 'condiciones', 'termini'],
  impressum: ['impressum', 'legal notice', 'mentions legales', 'aviso legal', 'note legali'],
  rights: ['rights', 'rechte', 'derechos', 'droits', 'diritti'],
  accessibility: ['accessibility', 'barrierefreiheit', 'accessibilite', 'accesibilidad', 'accessibilita']
};

const CONTENT_MARKERS = {
  data_categories: ['ip address', 'cookies', 'email', 'name', 'phone', 'address', 'location'],
  purposes: ['analytics', 'marketing', 'security', 'service', 'provision', 'optimization'],
  retention: ['retention', 'storage', 'duration', 'deletion', 'period', 'aufbewahrung'],
  rights: ['right to access', 'erasure', 'portability', 'rectification', 'objection', 'withdraw consent'],
  laws: ['gdpr', 'dsgvo', 'rgpd', 'uk gdpr', 'data protection act', 'privacy act']
};

function getLawContext(domain: string) {
  const d = domain.toLowerCase();
  if (d.endsWith('.de')) return { law: 'BITV 2.0 / GDPR / TMG', fine: 'до €50,000 / 4% оборота', region: 'DE' };
  if (d.endsWith('.fr')) return { law: 'RGAA / GDPR / LIL', fine: 'до €20 млн / 4% оборота', region: 'FR' };
  if (d.endsWith('.it')) return { law: 'GDPR / Codice Privacy', fine: 'до 4% оборота', region: 'IT' };
  if (d.endsWith('.es')) return { law: 'LOPDGDD / GDPR', fine: 'до €20 млн', region: 'ES' };
  return { law: 'EU GDPR / ePrivacy', fine: 'до €20 млн или 4% оборота', region: 'EU' };
}

export function shouldRunDeepScan(html: string): boolean {
  const indicators = ['react.js', 'vue.js', '_next/static', 'gtm.js', 'fbevents.js', 'cookie-banner', 'cmp'];
  const lowerHtml = html.toLowerCase();
  return indicators.some(indicator => lowerHtml.includes(indicator));
}

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string): { violations: Violation[], discoveredLinks: string[] } {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];
  const currentUrl = new URL(url);
  const domain = currentUrl.hostname.toLowerCase();
  const lawContext = getLawContext(domain);
  const bodyText = $('body').text().toLowerCase();
  const siteLang = $('html').attr('lang')?.toLowerCase()?.split('-')[0] || 'en';

  // 1. Link Discovery (Deep Crawl)
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      const absoluteUrl = new URL(href, url);
      if (absoluteUrl.hostname === domain) {
        discoveredLinks.push(absoluteUrl.href);
      }
    } catch (e) {}
  });

  // 2. Technical Checks
  if (!url.startsWith('https:')) {
    violations.push({
      category: 'Security',
      issue_type: 'Отсутствие HTTPS шифрования',
      severity: 'critical',
      evidence_html: url,
      description: 'Site is running over unencrypted HTTP.',
      law_name: 'GDPR Art. 32 (Security of processing)',
      potential_fine: lawContext.fine,
      explanation: 'Отсутствие SSL-сертификата делает невозможным обеспечение безопасности передачи данных.',
      recommendation: 'Установите SSL-сертификат и настройте 301 редирект на HTTPS.'
    });
  }

  // 3. Legal Document Discovery & Analysis
  const foundDocs: Record<string, string | null> = { privacy: null, cookies: null, impressum: null };
  
  $('a').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    
    for (const [key, keywords] of Object.entries(LEGAL_KEYWORDS)) {
      if (keywords.some(k => text.includes(k) || href.includes(k))) {
        foundDocs[key] = new URL(href, url).href;
      }
    }
  });

  // 4. Content Analysis for Privacy Policy
  if (foundDocs.privacy || bodyText.includes('privacy policy') || bodyText.includes('datenschutzerklärung')) {
    const content = bodyText;
    
    // Check Completeness
    const missingItems = [];
    if (!CONTENT_MARKERS.retention.some(m => content.includes(m))) missingItems.push('Сроки хранения');
    if (!CONTENT_MARKERS.rights.some(m => content.includes(m))) missingItems.push('Права субъектов (Art. 15-22)');
    if (!CONTENT_MARKERS.data_categories.some(m => content.includes(m))) missingItems.push('Категории данных');
    
    if (missingItems.length > 0) {
      violations.push({
        category: 'Legal_Content',
        issue_type: 'Неполный юридический документ',
        severity: 'high',
        evidence_html: screenshot ? `data:image/jpeg;base64,${screenshot}` : url,
        snippet: `Missing clauses: ${missingItems.join(', ')}`,
        description: 'Privacy Policy is missing mandatory GDPR information.',
        law_name: 'GDPR Art. 13/14',
        potential_fine: lawContext.fine,
        explanation: 'Документ не содержит всех обязательных сведений о процессах обработки данных.',
        recommendation: 'Обновите политику, добавив разделы о сроках хранения и правах пользователей.'
      });
    }

    // Check Recency
    const dateRegex = /(?:last updated|stand|aktualisiert|updated|fecha):?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4}|\w+\s\d{1,2},?\s\d{4})/gi;
    const dateMatch = dateRegex.exec(content);
    if (dateMatch) {
      try {
        const updateDate = new Date(dateMatch[1]);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (updateDate < oneYearAgo) {
          violations.push({
            category: 'Legal_Content',
            issue_type: 'Устаревший документ',
            severity: 'medium',
            evidence_html: url,
            snippet: `Found date: ${dateMatch[1]}`,
            description: 'Document has not been updated for more than 12 months.',
            law_name: 'GDPR Art. 5(1)(a) - Transparency',
            potential_fine: 'до €20 млн',
            explanation: 'Политика конфиденциальности должна регулярно пересматриваться.',
            recommendation: 'Проведите аудит процессов обработки и обновите дату в документе.'
          });
        }
      } catch (e) {}
    }
  } else if (domain.endsWith('.de') || domain.endsWith('.at')) {
    // Impressum check for DACH region
    if (!foundDocs.impressum) {
      violations.push({
        category: 'Privacy',
        issue_type: 'Отсутствие Impressum (DACH)',
        severity: 'critical',
        evidence_html: url,
        description: 'Mandatory legal disclosure is missing for a DACH-region domain.',
        law_name: '§ 5 TMG / § 25 Mediengesetz',
        potential_fine: 'до €50,000',
        explanation: 'Для сайтов в зоне .de/.at обязателен раздел Impressum с контактами владельца.',
        recommendation: 'Создайте страницу Impressum и добавьте ссылку в футер.'
      });
    }
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 50) 
  };
}
