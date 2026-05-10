
import * as cheerio from 'cheerio';
import { Violation, ReportType } from '@/types';

const LEGAL_KEYWORDS: Record<string, string[]> = {
  privacy: ['privacy', 'datenschutz', 'confidentialite', 'privacidad', 'confidenzialita', 'politika privatnosti', 'privacy policy'],
  cookies: ['cookie', 'cookies', 'galletas', 'biscotti', 'cookie policy'],
  terms: ['terms', 'tos', 'conditions', 'bedingungen', 'condiciones', 'termini', 'terms of service'],
  impressum: ['impressum', 'legal notice', 'mentions legales', 'aviso legal', 'note legali'],
  legal_notice: ['legal notice', 'mentions legales', 'rechtliche hinweise'],
  consumer_rights: ['consumer rights', 'verbraucherrechte', 'droits des consommateurs', 'derechos del consumidor'],
  accessibility: ['accessibility', 'barrierefreiheit', 'accessibilite', 'accesibilidad', 'accessibilita']
};

const CONTENT_MARKERS = {
  data_categories: ['ip address', 'cookies', 'email', 'name', 'phone', 'address', 'location', 'personbezogene daten'],
  purposes: ['analytics', 'marketing', 'security', 'service', 'provision', 'optimization', 'zwecke'],
  retention: ['retention', 'storage', 'duration', 'deletion', 'period', 'aufbewahrung'],
  rights: ['right to access', 'erasure', 'portability', 'rectification', 'objection', 'withdraw consent', 'betroffenenrechte'],
  contacts: ['contact', 'email', 'address', 'controller', 'dpo', 'datenschutzbeachter'],
  laws: ['gdpr', 'dsgvo', 'rgpd', 'uk gdpr', 'data protection act']
};

const LANG_MARKERS: Record<string, string[]> = {
  de: ['der', 'die', 'das', 'und', 'ist'],
  fr: ['le', 'la', 'les', 'et', 'est'],
  es: ['el', 'la', 'los', 'y', 'es'],
  it: ['il', 'la', 'le', 'e', 'è'],
  en: ['the', 'and', 'is', 'for', 'that']
};

function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();
  let bestLang = 'en';
  let maxCount = 0;

  for (const [lang, markers] of Object.entries(LANG_MARKERS)) {
    const count = markers.reduce((acc, m) => acc + (lowerText.split(` ${m} `).length - 1), 0);
    if (count > maxCount) {
      maxCount = count;
      bestLang = lang;
    }
  }
  return bestLang;
}

function getLawContext(domain: string) {
  const d = domain.toLowerCase();
  if (d.endsWith('.de')) return { law: 'BITV 2.0 / GDPR / TMG', fine: 'up to €50,000 / 4% turnover' };
  if (d.endsWith('.fr')) return { law: 'RGAA / GDPR / LIL', fine: 'up to €20m / 4% turnover' };
  return { law: 'EU GDPR / ePrivacy', fine: 'up to €20m or 4% turnover' };
}

/**
 * Heuristic to determine if the page likely uses tracking scripts that require JS execution.
 */
export function shouldRunDeepScan(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  const dynamicMarkers = [
    'fbq(', // Facebook Pixel
    'gtag(', // Google Tag Manager
    'analytics.js',
    'googletagmanager',
    'cookiebot',
    'onetrust',
    'trustarc',
    'civicuk',
    'cookie-consent'
  ];
  return dynamicMarkers.some(m => lowerHtml.includes(m));
}

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string): { violations: Violation[], discoveredLinks: string[] } {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];
  const currentUrl = new URL(url);
  const domain = currentUrl.hostname.toLowerCase();
  const lawContext = getLawContext(domain);
  
  const bodyText = $('body').text().toLowerCase();
  const siteLang = $('html').attr('lang')?.toLowerCase()?.split('-')[0] || detectLanguage(bodyText);

  // 1. Link Discovery (Deep Crawl)
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      const absoluteUrl = new URL(href, url);
      if (absoluteUrl.hostname === domain) discoveredLinks.push(absoluteUrl.href);
    } catch (e) {}
  });

  // 2. Manual/Technical Checks (Manual Report)
  if (!url.startsWith('https:')) {
    violations.push({
      category: 'Security',
      report_type: 'Manual',
      issue_type: 'Missing HTTPS',
      severity: 'critical',
      evidence_html: url,
      description: 'Site is running over unencrypted HTTP.',
      law_name: 'GDPR Art. 32',
      potential_fine: lawContext.fine,
      explanation: 'Lack of encryption endangers user data.',
      recommendation: 'Configure SSL and redirect to HTTPS.'
    });
  }

  // 3. Document Discovery & SaaS Content Audit
  const docsFound: Record<string, string | null> = {};
  for (const key of Object.keys(LEGAL_KEYWORDS)) docsFound[key] = null;

  $('a').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    for (const [key, keywords] of Object.entries(LEGAL_KEYWORDS)) {
      if (keywords.some(k => text.includes(k) || href.includes(k))) {
        docsFound[key] = new URL(href, url).href;
      }
    }
  });

  // Missing Documents (SaaS Report)
  const mandatoryDocs = ['privacy', 'cookies', 'terms'];
  mandatoryDocs.forEach(doc => {
    if (!docsFound[doc]) {
      violations.push({
        category: 'Legal_Content',
        report_type: 'SaaS',
        issue_type: `Document Missing: ${doc.toUpperCase()}`,
        severity: 'critical',
        evidence_html: url,
        description: `Mandatory ${doc} document not found on the website.`,
        law_name: 'GDPR Art. 13',
        potential_fine: lawContext.fine,
        explanation: 'Missing mandatory legal information is a gross violation of transparency.',
        recommendation: `Create and publish a ${doc} document.`
      });
    }
  });

  // Content Audit of existing docs
  if (bodyText.includes('policy') || bodyText.includes('datenschutz') || bodyText.includes('privacy')) {
    // Language Check
    const docLang = detectLanguage(bodyText);
    if (docLang !== siteLang && bodyText.length > 500) {
      violations.push({
        category: 'Legal_Content',
        report_type: 'SaaS',
        issue_type: 'Missing Local Language',
        severity: 'medium',
        evidence_html: url,
        description: `Policy is in ${docLang} but site is in ${siteLang}.`,
        law_name: 'GDPR Art. 12 (Transparency)',
        potential_fine: 'up to €20m',
        explanation: 'Legal documents must be understandable to the user in their language.',
        recommendation: 'Translate legal documents into the site interface language.'
      });
    }

    // Completeness (SaaS Report)
    const missingBlocks = [];
    if (!CONTENT_MARKERS.data_categories.some(m => bodyText.includes(m))) missingBlocks.push('Data Categories');
    if (!CONTENT_MARKERS.retention.some(m => bodyText.includes(m))) missingBlocks.push('Retention Periods');
    if (!CONTENT_MARKERS.rights.some(m => bodyText.includes(m))) missingBlocks.push('User Rights');
    if (!CONTENT_MARKERS.contacts.some(m => bodyText.includes(m))) missingBlocks.push('Controller Contacts');

    if (missingBlocks.length > 0 && bodyText.length > 300) {
      violations.push({
        category: 'Legal_Content',
        report_type: 'SaaS',
        issue_type: 'Incomplete Document',
        severity: 'high',
        evidence_html: screenshot ? `data:image/jpeg;base64,${screenshot}` : url,
        snippet: `Missing blocks: ${missingBlocks.join(', ')}`,
        description: 'Privacy document is missing mandatory GDPR clauses.',
        law_name: 'GDPR Art. 13/14',
        potential_fine: lawContext.fine,
        explanation: 'The document lacks critical information about rights or retention periods.',
        recommendation: 'Add missing sections to the text of the document.'
      });
    }

    // Recency Check
    const dateRegex = /(?:last updated|stand|updated|fecha|дата):?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4}|\w+\s\d{1,2},?\s\d{4})/gi;
    const dateMatch = dateRegex.exec(bodyText);
    if (dateMatch) {
      try {
        const updateDate = new Date(dateMatch[1]);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (updateDate < oneYearAgo) {
          violations.push({
            category: 'Legal_Content',
            report_type: 'SaaS',
            issue_type: 'Outdated Document',
            severity: 'medium',
            evidence_html: url,
            description: 'Document has not been updated for over 12 months.',
            law_name: 'GDPR Art. 5 (Transparency)',
            potential_fine: 'up to €20m',
            explanation: 'Documents must reflect current data processing activities.',
            recommendation: 'Conduct an annual audit and update the document date.'
          });
        }
      } catch (e) {}
    }
  }

  return { violations, discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 50) };
}
