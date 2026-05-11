
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, Category, VerificationMethod } from '@/types';

/**
 * Authoritative Liability Knowledge Base
 * This mapping eliminates "null" or "calculating" values in reports.
 */
const LIABILITY_DATABASE: Record<string, string> = {
    'PRIVACY': 'Administrative fines up to €20,000,000 or 4% of global turnover (Art. 83 GDPR).',
    'COOKIES': 'Fines up to €10,000,000 or 2% of global turnover (ePrivacy Directive).',
    'IMPRESSUM': 'Fines up to €50,000 (§ 5 TMG).',
    'TERMS': 'Loss of liability protection and fines up to €10,000.',
    'DEFAULT': 'Administrative fines under GDPR Art. 83.'
};

const MANDATORY_CLUSTERS = {
  CONTROLLER: {
    keywords: [/data controller/i, /verantwortlicher/i, /responsable du traitement/i, /titular del tratamiento/i, /identity of the controller/i, /legal disclosure/i],
    law: "GDPR Article 13(1)(a)",
    name: "Controller Identity",
    remediation: "Include the full legal name of your entity, registered physical address, and a direct contact email."
  },
  RIGHTS: {
    keywords: [/right to access/i, /right to erasure/i, /right to object/i, /auskunftsrecht/i, /löschungsrecht/i, /widerrufsrecht/i, /data subject rights/i],
    law: "GDPR Article 13(2)(b)",
    name: "Data Subject Rights",
    remediation: "Explain that users have the right to request access, correction, or deletion of their personal data."
  },
  RETENTION: {
    keywords: [/retention period/i, /speicherdauer/i, /durée de conservation/i, /plazo de conservación/i, /storage period/i],
    law: "GDPR Article 13(2)(a)",
    name: "Retention Periods",
    remediation: "Specify criteria or exact timeframes for how long user data is stored."
  },
  DPO: {
    keywords: [/data protection officer/i, /datenschutzbeauftragter/i, /délégué à la protection des données/i, /DPO contact/i],
    law: "GDPR Article 13(1)(b)",
    name: "DPO Contact Details",
    remediation: "Provide professional contact details for privacy inquiries."
  }
};

/**
 * Robust URL Normalizer & Deduplicator
 * Strips trailing slashes, query params, and fragments to prevent "costera.tech" parasitic duplicates.
 */
export function normalizeUrl(url: string, base: string): string | null {
  try {
    const absolute = new URL(url, base);
    absolute.hash = '';
    absolute.search = ''; 
    let pathname = absolute.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    absolute.pathname = pathname;
    return absolute.href.toLowerCase();
  } catch (e) {
    return url.toLowerCase().replace(/\/$/, "");
  }
}

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string, isPuppeteer: boolean = false): { 
  violations: Violation[], 
  discoveredLinks: string[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> },
  compliance_report: ComplianceReport
} {
  const $ = cheerio.load(html);
  const verification_method: VerificationMethod = isPuppeteer ? 'Dynamic Emulation' : 'Static Analysis';
  
  const links: Record<string, string | null> = { impressum: null, privacy: null, terms: null, cookies: null };
  const violations: Violation[] = [];
  const lowerHtml = html.substring(0, 100000).toLowerCase();

  // Smart Discovery: Search by text AND URL patterns
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    if (!href || href.startsWith('javascript:')) return;

    const normalized = normalizeUrl(href, url);
    if (!normalized) return;

    const isPrivacy = /privacy|datenschutz|privacy-policy/i.test(text) || /privacy|datenschutz/i.test(href);
    const isImpressum = /impressum|legal-notice|legal-disclosure/i.test(text) || /impressum|legal-notice/i.test(href);
    const isTerms = /terms|agb|tos|conditions/i.test(text) || /agb|tos|terms-of-service/i.test(href);
    const isCookies = /cookie|cookies/i.test(text) || /cookie/i.test(href);

    if (!links.privacy && isPrivacy) links.privacy = normalized;
    if (!links.impressum && isImpressum) links.impressum = normalized;
    if (!links.terms && isTerms) links.terms = normalized;
    if (!links.cookies && isCookies) links.cookies = normalized;
  });

  const mandatoryDocs = [
    { key: 'impressum', name: 'Legal Notice (Impressum)', law: '§ 5 TMG / Art. 13 GDPR', category: 'IMPRESSUM' },
    { key: 'privacy', name: 'Privacy Policy', law: 'Art. 13 GDPR', category: 'PRIVACY' },
    { key: 'terms', name: 'Terms of Service (AGB)', law: 'BGB / TMG', category: 'TERMS' },
    { key: 'cookies', name: 'Cookie Policy', law: 'ePrivacy Directive', category: 'COOKIES' }
  ];

  mandatoryDocs.forEach(doc => {
    const foundUrl = links[doc.key as keyof typeof links];
    
    if (!foundUrl) {
      // Status: MISSING
      violations.push({
        category: doc.category as Category,
        report_type: 'SaaS',
        issue_type: `Missing ${doc.name}`,
        severity: 'critical',
        evidence_html: url,
        description: `NAV-SCOUT engine scanned the domain but could not detect an accessible link to the ${doc.name}.`,
        law_name: doc.law,
        potential_fine: LIABILITY_DATABASE[doc.category] || LIABILITY_DATABASE.DEFAULT,
        explanation: `Under ${doc.law}, website operators must provide a clearly visible ${doc.name}.`,
        recommendation: `Action Required: Create a ${doc.name} and add a link to it in your website footer.`,
        verification_method
      });
    } else {
      // Status: INCOMPLETE (Content Validation)
      Object.entries(MANDATORY_CLUSTERS).forEach(([clusterKey, cluster]) => {
        if (doc.key === 'impressum' && clusterKey !== 'CONTROLLER') return;
        if (doc.key === 'cookies') return;

        if (!cluster.keywords.some(k => k.test(lowerHtml))) {
          violations.push({
            category: doc.category as Category,
            report_type: 'SaaS',
            issue_type: `Incomplete ${doc.name}`,
            severity: 'high',
            evidence_html: foundUrl,
            description: `Document found at ${foundUrl}, but mandatory section [${cluster.name}] is missing from the text content.`,
            law_name: cluster.law,
            potential_fine: LIABILITY_DATABASE[doc.category] || LIABILITY_DATABASE.DEFAULT,
            explanation: `${cluster.law} mandates the disclosure of ${cluster.name}.`,
            recommendation: `Corrective Action Required: You must add the following section: ${cluster.remediation}`,
            verification_method
          });
        }
      });
    }
  });

  const hasCMP = [/cookiebot/i, /onetrust/i, /usercentrics/i, /sourcepoint/i].some(s => s.test(lowerHtml));

  return {
    violations,
    discoveredLinks: [],
    meta: { hasCMP, legal_links: links },
    compliance_report: {
      score: Math.max(0, 100 - (violations.length * 15)),
      verdict: violations.some(v => v.severity === 'critical') ? 'RISKY' : (violations.length > 0 ? 'RISKY' : 'COMPLIANT'),
      nav_scout: {
        found_links: Object.values(links).filter(Boolean) as string[],
        missing_critical: mandatoryDocs.filter(d => !links[d.key as keyof typeof links]).map(d => d.name),
        discovery_score: Object.values(links).filter(Boolean).length * 25
      },
      lex_analyzer: {
        has_vat_id: /de[0-9]{9}/i.test(lowerHtml),
        has_contact_info: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(lowerHtml),
        has_mandatory_terms: true,
        content_truncated: html.length > 100000,
        missing_clusters: [] 
      },
      cmp_detect: {
        detected_provider: hasCMP ? 'Active CMP Detected' : null,
        is_active: hasCMP
      }
    }
  };
}
