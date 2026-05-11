
import * as cheerio from 'cheerio';
import { Violation, Category } from '@/types';

const LEGAL_PATTERNS = {
  impressum: [/impressum/i, /legal notice/i, /mentions l[eé]gales/i, /aviso legal/i, /note legali/i],
  privacy: [/privacy/i, /datenschutz/i, /confidentialit[eé]/i, /privacidad/i, /politika privatnosti/i],
  terms: [/terms/i, /tos/i, /conditions/i, /bedingungen/i, /condiciones/i, /agb/i],
  cookies: [/cookie/i, /galletas/i, /biscotti/i]
};

const CMP_MARKERS = [
  'onetrust', 'cookiebot', 'cookie-consent', 'cookiebot', 'quantcast', 'didomi', 'trustarc', 'civicuk'
];

/**
 * Advanced Compliance Parser: NAV-SCOUT & LEX-ANALYZER Engines
 */
export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string): { 
  violations: Violation[], 
  discoveredLinks: string[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> }
} {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];
  const targetUrl = new URL(url);
  const domain = targetUrl.hostname.toLowerCase();
  
  const bodyText = $('body').text().toLowerCase();
  const hasCMP = CMP_MARKERS.some(m => html.toLowerCase().includes(m));

  // 1. Link Discovery
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      const absoluteUrl = new URL(href, url);
      if (absoluteUrl.hostname === domain) discoveredLinks.push(absoluteUrl.href);
    } catch (e) {}
  });

  // 2. NAV-SCOUT Engine: Link Analysis
  const legal_links: Record<string, string | null> = { impressum: null, privacy: null, terms: null, cookies: null };
  
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    
    for (const [key, patterns] of Object.entries(LEGAL_PATTERNS)) {
      if (patterns.some(p => p.test(text) || p.test(href))) {
        legal_links[key] = new URL(href, url).href;
      }
    }
  });

  // Generate NAV-SCOUT Violations
  const isDACH = domain.endsWith('.de') || domain.endsWith('.at') || domain.endsWith('.ch');
  if (isDACH && !legal_links.impressum) {
    violations.push({
      category: 'Legal_Content',
      report_type: 'SaaS',
      issue_type: 'Missing Impressum',
      severity: 'critical',
      evidence_html: url,
      description: 'NAV-SCOUT engine scanned the footer and did not detect a link to Impressum. This is a high-risk transparency violation under §5 TMG.',
      law_name: '§5 TMG (Germany)',
      potential_fine: '€500 - €50,000',
      explanation: 'In German-speaking jurisdictions, the Impressum must be "easily recognizable, directly accessible, and permanently available".',
      recommendation: 'Add a clearly labeled "Impressum" link to your website footer.'
    });
  }

  if (!legal_links.privacy) {
    violations.push({
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'Missing Privacy Policy',
      severity: 'critical',
      evidence_html: url,
      description: 'NAV-SCOUT engine failed to identify a Privacy Policy link. This is a fundamental violation of GDPR Art. 13/14.',
      law_name: 'GDPR Art. 13/14',
      potential_fine: '€10,000 - €20,000,000',
      explanation: 'Failure to provide transparent information about data processing is a primary audit target for Data Protection Authorities.',
      recommendation: 'Ensure a Privacy Policy link is visible on every page, typically in the footer.'
    });
  }

  // 3. LEX-ANALYZER Engine: Content Analysis
  if (legal_links.privacy && bodyText.length > 500) {
    const mandatorySections = ['retention', 'rights', 'contact', 'cookies'];
    const missing = mandatorySections.filter(s => !bodyText.includes(s));
    
    if (missing.length > 0) {
      violations.push({
        category: 'Legal_Content',
        report_type: 'SaaS',
        issue_type: 'Incomplete Privacy Content',
        severity: 'high',
        evidence_html: screenshot ? `data:image/jpeg;base64,${screenshot}` : url,
        description: `LEX-ANALYZER engine analyzed the text. Link found, but mandatory sections (${missing.join(', ')}) are missing from the content.`,
        law_name: 'GDPR Art. 13',
        potential_fine: '€5,000 - €1,000,000',
        explanation: 'A Privacy Policy that omits data subject rights or retention periods is legally insufficient.',
        recommendation: 'Update your privacy documentation to include missing mandatory clauses.'
      });
    }
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 50),
    meta: { hasCMP, legal_links }
  };
}

export function shouldRunDeepScan(html: string): boolean {
  const $ = cheerio.load(html);
  return $('#app').length > 0 || $('#root').length > 0 || CMP_MARKERS.some(m => html.toLowerCase().includes(m));
}
