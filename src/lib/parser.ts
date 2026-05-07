
import * as cheerio from 'cheerio';
import { Violation, Category, Severity } from '@/types';

/**
 * Эвристическая проверка: нужен ли запуск браузера (Deep Scan).
 */
export function shouldRunDeepScan(html: string): boolean {
  const indicators = [
    'react.js', 'vue.js', '_next/static', 'gtm.js', 'fbevents.js', 
    'adsbygoogle', 'intercom', 'cookie-law', 'cookie-banner', 
    'cookie-consent', 'trustarc', 'onetrust', 'didomi'
  ];
  const lowerHtml = html.toLowerCase();
  return indicators.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
}

/**
 * Основной парсер HTML для технического и комплаенс аудита.
 * Дополнен ADA ролями, проверкой пустых секций и рекомендациями.
 */
export function parseHtmlContent(html: string, url: string, headers: any = {}): { violations: Violation[], discoveredLinks: string[] } {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];

  // Извлечение ссылок для обхода
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const absoluteUrl = new URL(href, url).href;
        if (absoluteUrl.startsWith('http')) {
           discoveredLinks.push(absoluteUrl);
        }
      } catch (e) {}
    }
  });

  // --- ADA Compliance Audit ---
  
  // 1. Изображения без атрибута ALT
  $('img:not([alt])').each((_, el) => {
    violations.push({
      category: 'ADA',
      issue_type: 'MISSING_ALT_TEXT',
      severity: 'medium',
      evidence_html: $.html(el),
      description: 'Элемент изображения не имеет атрибута alt.',
      recommendation: 'Добавьте атрибут alt с описанием изображения для пользователей программ экранного доступа.'
    });
  });

  // 2. Отсутствие ролей у сложных структурных элементов
  const complexElements = ['nav', 'main', 'aside', 'section', 'article'];
  complexElements.forEach(tag => {
    $(tag).each((_, el) => {
      if (!$(el).attr('role')) {
        violations.push({
          category: 'ADA',
          issue_type: 'MISSING_ARIA_ROLE',
          severity: 'low',
          evidence_html: $.html(el).substring(0, 100) + '...',
          description: `Элемент <${tag}> не имеет явно заданной роли ARIA.`,
          recommendation: `Укажите атрибут role (например, role="navigation" для nav), чтобы улучшить навигацию для ассистивных технологий.`
        });
      }
    });
  });

  // 3. Пустые или неинформативные теги header/footer
  ['header', 'footer'].forEach(tag => {
    $(tag).each((_, el) => {
      if ($(el).text().trim().length === 0) {
        violations.push({
          category: 'ADA',
          issue_type: 'EMPTY_STRUCTURAL_ELEMENT',
          severity: 'medium',
          evidence_html: $.html(el),
          description: `Обнаружен пустой элемент <${tag}>.`,
          recommendation: 'Удалите пустые структурные теги или наполните их контентом. Пустые ориентиры сбивают с толку пользователей программ экранного доступа.'
        });
      }
    });
  });

  // 4. Пустые интерактивные элементы
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    if (!text && !ariaLabel) {
      violations.push({
        category: 'ADA',
        issue_type: 'EMPTY_INTERACTIVE_ELEMENT',
        severity: 'high',
        evidence_html: $.html(el),
        description: 'Ссылка или кнопка не содержит текста или метки.',
        recommendation: 'Добавьте текстовое содержимое или атрибут aria-label, чтобы пользователь понимал назначение элемента.'
      });
    }
  });

  // --- GDPR & Privacy Audit ---

  // 5. Внешние Google Fonts
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    violations.push({
      category: 'GDPR',
      issue_type: 'EXTERNAL_GOOGLE_FONTS',
      severity: 'medium',
      evidence_html: $.html(el),
      description: 'Загрузка шрифтов Google напрямую с серверов Google (утечка IP).',
      recommendation: 'Хостите шрифты локально на своем сервере, чтобы избежать передачи IP-адресов пользователей третьим лицам без их согласия.'
    });
  });

  // 6. Формы на HTTP
  $('form').each((_, el) => {
    const action = $(el).attr('action') || '';
    const isUnsecure = action.startsWith('http://') || (!action.startsWith('https://') && url.startsWith('http://'));
    if (isUnsecure) {
      violations.push({
        category: 'GDPR',
        issue_type: 'UNSECURE_FORM_SUBMISSION',
        severity: 'critical',
        evidence_html: $.html(el),
        description: 'Форма отправляет данные по незащищенному протоколу HTTP.',
        recommendation: 'Настройте SSL-сертификат и используйте https:// для всех путей отправки данных. Это критическое требование безопасности.'
      });
    }
  });

  // 7. Поиск Политики Конфиденциальности
  const hasPrivacyLink = $('a').toArray().some(a => {
    const text = $(a).text().toLowerCase();
    const href = $(a).attr('href')?.toLowerCase() || '';
    return text.includes('privacy') || text.includes('policy') || text.includes('политика') || href.includes('privacy');
  });

  if (!hasPrivacyLink) {
    violations.push({
      category: 'Privacy',
      issue_type: 'MISSING_PRIVACY_POLICY',
      severity: 'high',
      evidence_html: 'Footer Links Scan',
      description: 'Ссылка на Политику конфиденциальности не найдена.',
      recommendation: 'Разместите ссылку на Privacy Policy на видном месте (обычно в футере), как того требует GDPR и CCPA.'
    });
  }

  // --- Security Audit ---

  // 8. Отсутствие CSP
  const hasCSP = $('meta[http-equiv="Content-Security-Policy"]').length > 0 || headers['content-security-policy'];
  if (!hasCSP) {
    violations.push({
      category: 'Security',
      issue_type: 'MISSING_CSP',
      severity: 'medium',
      evidence_html: 'HTTP Headers / Meta Tags',
      description: 'Отсутствует политика безопасности контента (CSP).',
      recommendation: 'Внедрите заголовок Content-Security-Policy для защиты сайта от XSS-атак и инъекций кода.'
    });
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 10) 
  };
}
