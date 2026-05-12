
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, Category, VerificationMethod } from '@/types';

/**
 * AUTHORITATIVE LIABILITY DATABASE
 * Provides professional administrative penalty ranges based on GDPR Article 83.
 */
const LIABILITY_DATABASE: Record<string, string> = {
    'PRIVACY': 'Administrative fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR).',
    'COOKIES': 'Fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR).',
    'IMPRESSUM': 'Fines up to €50,000 (German TMG §5).',
    'TERMS': 'Potential loss of liability protection and consumer law penalties.',
    'LEGAL_GROUNDS': 'Critical fines for unlawful processing under Art. 83(5)(a) GDPR (Up to €20M).',
    'DEFAULT': 'Administrative fines up to €20,000,000 or 4% of global turnover.'
};

/**
 * Mandatory Legal Clusters for Semantic Analysis
 */
const MANDATORY_CLUSTERS = {
  CONTROLLER: {
    keywords: [/data controller/i, /verantwortlicher/i, /responsable du traitement/i, /identity of the controller/i, /legal disclosure/i, /registered office/i, /provider identification/i],
    law: "Art. 13(1)(a) GDPR",
    name: "Controller Identity",
    remediation: "Include the full legal name of your entity, registered physical address, and a direct contact email."
  },
  RIGHTS: {
    keywords: [/right to access/i, /right to erasure/i, /right to object/i, /auskunftsrecht/i, /löschungsrecht/i, /widerrufsrecht/i, /data subject rights/i, /your rights/i, /art\. 15/i],
    law: "Art. 13(2)(b) GDPR",
    name: "Data Subject Rights",
    remediation: "Explain that users have the right to request access, correction, or deletion of their personal data."
  },
  RETENTION: {
    keywords: [/retention period/i, /speicherdauer/i, /durée de conservation/i, /plazo de conservación/i, /storage period/i, /how long we keep/i, /retention policy/i],
    law: "Art. 13(2)(a) GDPR",
    name: "Retention Periods",
    remediation: "Specify criteria or exact timeframes for how long user data is stored."
  },
  DPO: {
    keywords: [/data protection officer/i, /datenschutzbeaustragter/i, /délégué à la protection des données/i, /DPO contact/i, /privacy officer/i, /dataprotectionofficer/i],
    law: "Art. 13(1)(b) GDPR",
    name: "DPO Contact Details",
    remediation: "Provide professional contact details for privacy inquiries."
  }
};

const PROCESSING_ACTIVITIES = [
  { name: 'Analyzing usage', keywords: [/analytics/i, /tracking/i, /usage analysis/i, /hotjar/i, /google analytics/i], defaultBasis: 'Art. 6(1)(f) (Legitimate Interests)' },
  { name: 'Marketing / Advertising', keywords: [/marketing/i, /advertising/i, /newsletter/i, /remarketing/i], defaultBasis: 'Art. 6(1)(a) (Consent)' },
  { name: 'Fraud prevention', keywords: [/fraud/i, /security/i, /prevention/i, /bot detection/i], defaultBasis: 'Art. 6(1)(f) (Legitimate Interests)' },
  { name: 'Customer Support / Communication', keywords: [/support/i, /contact form/i, /zendesk/i, /intercom/i], defaultBasis: 'Art. 6(1)(b) (Performance of Contract)' }
];

const LEGAL_BASES = [
  { name: 'Consent', keywords: [/consent/i, /art\. 6\(1\)\(a\)/i, /einwilligung/i], article: '6(1)(a)' },
  { name: 'Contract', keywords: [/contract/i, /performance of a contract/i, /art\. 6\(1\)\(b\)/i], article: '6(1)(b)' },
  { name: 'Legal Obligation', keywords: [/legal obligation/i, /compliance/i, /art\. 6\(1\)\(c\)/i], article: '6(1)(c)' },
  { name: 'Legitimate Interests', keywords: [/legitimate interest/i, /berechtigtes interesse/i, /art\. 6\(1\)\(f\)/i], article: '6(1)(f)' }
];

function requiresImpressum(url: string, html: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const dachTlds = ['.de', '.at', '.ch', '.li'];
    if (dachTlds.some(tld => hostname.endsWith(tld))) return true;
    const isGermanLanguage = /lang="de"/i.test(html) || /datenschutz|impressum|kontakt/i.test(html);
    if (isGermanLanguage) return true;
    return false;
  } catch (e) { return false; }
}

export function normalizeUrl(url: string, base: string): string | null {
  try {
    const absolute = new URL(url, base);
    absolute.hash = '';
    absolute.search = '';
    let pathname = absolute.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith('/')) { pathname = pathname.slice(0, -1); }
    absolute.pathname = pathname;
    return absolute.href.toLowerCase();
  } catch (e) { return url.toLowerCase().replace(/\/$/, "").split('?')[0]; }
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
  const fullText = html.substring(0, 300000).toLowerCase();
  const footerText = $('footer').text().toLowerCase();

  // NAV-SCOUT: Pattern-First Discovery Logic
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

    const normalized = normalizeUrl(href, url);
    if (!normalized) return;

    const isPrivacy = /privacy|datenschutz|protection|privacy-policy/i.test(text) || /privacy|datenschutz|protection/i.test(href);
    const isImpressum = /impressum|legal-notice|legal-disclosure|legalnotice/i.test(text) || /impressum|legal-notice|legal-disclosure/i.test(href);
    const isTerms = /terms|agb|tos|usage|terms-of-service/i.test(text) || /agb|tos|terms|usage/i.test(href);
    const isCookies = /cookie|cookies/i.test(text) || /cookie/i.test(href);

    if (!links.privacy && isPrivacy) links.privacy = normalized;
    if (!links.impressum && isImpressum) links.impressum = normalized;
    if (!links.terms && isTerms) links.terms = normalized;
    if (!links.cookies && isCookies) links.cookies = normalized;
  });

  const mandatoryDocsConfig = [
    { key: 'privacy', name: 'Privacy Policy', law: 'Art. 13 GDPR', category: 'PRIVACY', required: true },
    { key: 'cookies', name: 'Cookie Policy', law: 'Art. 13 GDPR', category: 'COOKIES', required: true },
    { key: 'terms', name: 'Terms of Service', law: 'Consumer Rights Act', category: 'TERMS', required: true },
    { key: 'impressum', name: 'Legal Notice (Impressum)', law: '§ 5 TMG', category: 'IMPRESSUM', required: requiresImpressum(url, html) }
  ];

  mandatoryDocsConfig.forEach(doc => {
    if (!doc.required) return;
    const foundUrl = links[doc.key as keyof typeof links];
    
    if (!foundUrl) {
      violations.push({
        category: doc.category as Category,
        report_type: 'SaaS',
        issue_type: `Missing ${doc.name}`,
        severity: 'critical',
        evidence_html: url,
        description: `NAV-SCOUT structural audit failed to identify a compliant ${doc.name} matching standard patterns.`,
        law_name: doc.law,
        potential_fine: LIABILITY_DATABASE[doc.category] || LIABILITY_DATABASE.DEFAULT,
        explanation: `Under ${doc.law}, website operators are strictly required to provide a clearly visible and accessible ${doc.name}.`,
        recommendation: `REMEDIATION BLUEPRINT: Implement a compliant ${doc.name} and provide a permanent link in the global footer.`,
        verification_method
      });
    } else {
      // Lex-Analyzer for cluster verification
      Object.entries(MANDATORY_CLUSTERS).forEach(([clusterKey, cluster]) => {
        if (doc.key === 'cookies' || doc.key === 'terms') return;
        
        const clusterFound = cluster.keywords.some(k => k.test(fullText));
        
        if (clusterKey === 'CONTROLLER') {
          const inFooter = cluster.keywords.some(k => k.test(footerText));
          if (!clusterFound && inFooter) {
            violations.push({
              category: doc.category as Category,
              report_type: 'SaaS',
              issue_type: `Incomplete Disclosure: ${cluster.name}`,
              severity: 'low',
              evidence_html: url,
              description: `Status: Detected in website footer. Requirement: While present in the footer, Article 13 transparency principles require this information to be explicitly included within the main body of the Privacy Policy document.`,
              law_name: cluster.law,
              potential_fine: LIABILITY_DATABASE[doc.category],
              explanation: `Art. 13 GDPR mandates explicit disclosure. While present in the footer, best practices and statutory transparency standards require inclusion inside the policy body.`,
              recommendation: `REMEDIATION BLUEPRINT: Status: Detected in website footer. Requirement: While present in the footer, Article 13 transparency principles require this information to be explicitly included within the main body of the Privacy Policy document.`,
              verification_method
            });
          } else if (!clusterFound) {
            violations.push({
              category: doc.category as Category,
              report_type: 'SaaS',
              issue_type: `Incomplete Disclosure: ${cluster.name}`,
              severity: 'high',
              evidence_html: foundUrl,
              description: `Violation of ${cluster.law}. Document identified, but mandatory cluster [${cluster.name}] was not detected.`,
              law_name: cluster.law,
              potential_fine: LIABILITY_DATABASE[doc.category],
              explanation: `${cluster.law} mandates explicit disclosure regarding the identity and contact details of the controller.`,
              recommendation: `REMEDIATION BLUEPRINT: Corrective Action (Art. 13 Compliance): Append the full legal name and physical address of the data controller to the policy body.`,
              verification_method
            });
          }
        } else if (!clusterFound) {
          violations.push({
            category: doc.category as Category,
            report_type: 'SaaS',
            issue_type: `Incomplete ${doc.name}: ${cluster.name}`,
            severity: 'high',
            evidence_html: foundUrl,
            description: `Violation of ${cluster.law}. Cluster [${cluster.name}] missing from ${doc.name}.`,
            law_name: cluster.law,
            potential_fine: LIABILITY_DATABASE[doc.category],
            explanation: `${cluster.law} mandates explicit disclosure regarding ${cluster.name}.`,
            recommendation: `REMEDIATION BLUEPRINT: Corrective Action: Explicitly cite ${cluster.name} and provide details required by ${cluster.law}.`,
            verification_method
          });
        }
      });

      // Legal Basis Mapping (Art. 13(1)(c) & Art. 6)
      if (doc.key === 'privacy') {
        PROCESSING_ACTIVITIES.forEach(activity => {
          if (activity.keywords.some(k => k.test(fullText))) {
            const hasBasis = LEGAL_BASES.some(basis => basis.keywords.some(k => k.test(fullText)));
            if (!hasBasis) {
              violations.push({
                category: 'LEGAL_GROUNDS',
                report_type: 'SaaS',
                issue_type: `LACK OF EXPLICIT LEGAL BASES FOR PROCESSING`,
                severity: 'critical',
                evidence_html: foundUrl,
                description: `The website mentions '${activity.name}' but fails to explicitly link this activity to Art. 6(1)(f) (Legitimate Interests) or Art. 6(1)(a) (Consent).`,
                law_name: 'Art. 13(1)(c) GDPR',
                potential_fine: LIABILITY_DATABASE.LEGAL_GROUNDS,
                explanation: `Art. 13(1)(c) requires disclosure of the purposes of processing as well as the legal basis for that processing. Processing activities like '${activity.name}' must be explicitly linked to an Art. 6 legal basis.`,
                recommendation: `REMEDIATION BLUEPRINT: Explicitly state the legal basis for each processing activity. Example: State that '${activity.name}' is based on Art. 6(1)(f) (Legitimate Interests).`,
                verification_method
              });
            }
          }
        });
      }
    }
  });

  const hasCMP = [/cookiebot/i, /onetrust/i, /usercentrics/i, /cmp/i, /consent/i].some(s => s.test(fullText));

  return {
    violations,
    discoveredLinks: [],
    meta: { hasCMP, legal_links: links },
    compliance_report: {
      score: Math.max(0, 100 - (violations.length * 12)),
      verdict: violations.some(v => v.severity === 'critical') ? 'RISKY' : (violations.length > 0 ? 'RISKY' : 'COMPLIANT'),
      nav_scout: {
        found_links: Object.values(links).filter(Boolean) as string[],
        missing_critical: mandatoryDocsConfig.filter(d => d.required && !links[d.key as keyof typeof links]).map(d => d.name),
        discovery_score: Object.values(links).filter(Boolean).length * 25
      },
      lex_analyzer: {
        has_vat_id: /de[0-9]{9}/i.test(fullText) || /vat id/i.test(fullText),
        has_contact_info: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(fullText),
        has_mandatory_terms: true,
        content_truncated: html.length > 300000,
        missing_clusters: []
      },
      cmp_detect: {
        detected_provider: hasCMP ? 'Active CMP Detected' : null,
        is_active: hasCMP
      }
    }
  };
}
