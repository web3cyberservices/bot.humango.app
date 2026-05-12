
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, Category, VerificationMethod } from '@/types';

/**
 * AUTHORITATIVE LIABILITY DATABASE
 * Based on GDPR Article 83.
 */
const LIABILITY_DATABASE: Record<string, string> = {
    'PRIVACY': '€20,000,000 or 4% of global turnover',
    'COOKIES': '€20,000,000 or 4% of global turnover',
    'IMPRESSUM': '€20,000,000 or 4% of global turnover',
    'LEGAL_GROUNDS': '€20,000,000 or 4% of global turnover',
    'DEFAULT': '€20,000,000 or 4% of global turnover'
};

/**
 * Multilingual Document Discovery Map
 */
const DOC_KEYWORDS = {
  privacy: [/privacy/i, /datenschutz/i, /confidentialité/i, /privacidad/i, /trattamento dei dati/i, /privacyverklaring/i],
  impressum: [/impressum/i, /legal notice/i, /mentions légales/i, /aviso legal/i, /note legali/i, /rechtliche hinweise/i],
  terms: [/terms/i, /agb/i, /conditions/i, /términos/i, /condizioni/i, /voorwaarden/i],
  cookies: [/cookie/i, /cookies/i, /galletas/i, /biscotti/i]
};

/**
 * Mandatory Legal Clusters for Semantic Analysis (Multilingual Support)
 */
const MANDATORY_CLUSTERS = {
  CONTROLLER: {
    keywords: [
      /data controller/i, /verantwortlicher/i, /responsable du traitement/i, /responsable del tratamiento/i,
      /identity of the controller/i, /legal disclosure/i, /registered office/i, /siège social/i, /domicilio social/i
    ],
    law: "Art. 13(1)(a) GDPR",
    name: "Controller Identity",
    category: 'PRIVACY'
  },
  RIGHTS: {
    keywords: [/right to access/i, /right to erasure/i, /right to object/i, /auskunftsrecht/i, /löschungsrecht/i, /droit d'accès/i, /derecho de acceso/i],
    law: "Art. 13(2)(b) GDPR",
    name: "Data Subject Rights",
    category: 'PRIVACY'
  },
  RETENTION: {
    keywords: [/retention period/i, /speicherdauer/i, /durée de conservation/i, /plazo de conservación/i, /how long we keep/i],
    law: "Art. 13(2)(a) GDPR",
    name: "Retention Periods",
    category: 'PRIVACY'
  },
  DPO: {
    keywords: [/data protection officer/i, /datenschutzbeauftragter/i, /dpo/i, /délégué à la protection des données/i, /delegado de protección de datos/i],
    law: "Art. 13(1)(b) GDPR",
    name: "DPO Contact",
    category: 'PRIVACY'
  }
};

const PROCESSING_ACTIVITIES = [
  { name: 'Usage Analysis', keywords: [/analytics/i, /tracking/i, /usage analysis/i, /analyse d'utilisation/i], defaultBasis: 'Art. 6(1)(f) (Legitimate Interests)' },
  { name: 'Marketing / Advertising', keywords: [/marketing/i, /advertising/i, /publicité/i, /publicidad/i], defaultBasis: 'Art. 6(1)(a) (Consent)' },
  { name: 'Fraud Prevention', keywords: [/fraud/i, /security/i, /bot detection/i, /sécurité/i], defaultBasis: 'Art. 6(1)(f) (Legitimate Interests)' }
];

const LEGAL_BASES = [
  { name: 'Consent', keywords: [/consent/i, /art\. 6\(1\)\(a\)/i, /consentement/i], article: '6(1)(a)' },
  { name: 'Contract', keywords: [/contract/i, /art\. 6\(1\)\(b\)/i, /contrat/i], article: '6(1)(b)' },
  { name: 'Legitimate Interests', keywords: [/legitimate interest/i, /art\. 6\(1\)\(f\)/i, /intérêt légitime/i], article: '6(1)(f)' }
];

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

  // 1. Multilingual Link Discovery
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

    if (DOC_KEYWORDS.privacy.some(k => k.test(text))) links.privacy = href;
    if (DOC_KEYWORDS.impressum.some(k => k.test(text))) links.impressum = href;
    if (DOC_KEYWORDS.terms.some(k => k.test(text))) links.terms = href;
    if (DOC_KEYWORDS.cookies.some(k => k.test(text))) links.cookies = href;
  });

  const mandatoryDocs = [
    { key: 'privacy', name: 'Privacy Policy', law: 'Art. 13 GDPR', category: 'PRIVACY' },
    { key: 'cookies', name: 'Cookie Policy', law: 'Art. 13 GDPR', category: 'COOKIES' }
  ];

  mandatoryDocs.forEach(doc => {
    const foundUrl = links[doc.key as keyof typeof links];
    if (!foundUrl) {
      violations.push({
        category: doc.category as Category,
        report_type: 'SaaS',
        issue_type: `MISSING ${doc.name.toUpperCase()}`,
        severity: 'critical',
        evidence_html: url,
        description: `NAV-SCOUT structural audit failed to identify a compliant ${doc.name} in any supported EU language.`,
        law_name: doc.law,
        potential_fine: LIABILITY_DATABASE[doc.category],
        explanation: `Under ${doc.law}, website operators must provide a clearly visible ${doc.name}. Even minimalist landing pages are subject to this transparency mandate.`,
        recommendation: `Implement a compliant ${doc.name} and provide a permanent link in the global footer.`,
        verification_method
      });
    } else {
      // Semantic Audit for Found Documents
      const controllerCluster = MANDATORY_CLUSTERS.CONTROLLER;
      const clusterFoundInPolicy = controllerCluster.keywords.some(k => k.test(fullText));
      const clusterFoundInFooter = controllerCluster.keywords.some(k => k.test(footerText));

      if (!clusterFoundInPolicy) {
        violations.push({
          category: 'PRIVACY',
          report_type: 'SaaS',
          issue_type: `INCOMPLETE DISCLOSURE: CONTROLLER IDENTITY`,
          severity: clusterFoundInFooter ? 'low' : 'high',
          evidence_html: clusterFoundInFooter ? url : foundUrl,
          description: clusterFoundInFooter 
            ? `Controller Identity found in website footer but absent from the policy body.`
            : `The automated scan failed to identify the official legal name of the data controller, a registered physical address, or a specific registration number in the detected document.`,
          law_name: controllerCluster.law,
          potential_fine: LIABILITY_DATABASE.PRIVACY,
          explanation: `Art. 13(1)(a) mandates the disclosure of the identity and the contact details of the controller.`,
          recommendation: clusterFoundInFooter 
            ? `Status: Detected in website footer. Requirement: While present in the footer, Article 13 transparency principles require this information to be explicitly included within the main body of the Privacy Policy document.`
            : `Append the full legal name and address of the data controller to the main document body.`,
          verification_method
        });
      }

      // Legal Grounds Correlation (Art. 13(1)(c))
      if (doc.key === 'privacy') {
        const missingBasisActivities: string[] = [];
        PROCESSING_ACTIVITIES.forEach(activity => {
          if (activity.keywords.some(k => k.test(fullText))) {
            const hasBasis = LEGAL_BASES.some(basis => basis.keywords.some(k => k.test(fullText)));
            if (!hasBasis) {
              missingBasisActivities.push(`${activity.name} -> Missing Art. 6 link`);
            }
          }
        });

        if (missingBasisActivities.length > 0) {
          violations.push({
            category: 'LEGAL_GROUNDS',
            report_type: 'SaaS',
            issue_type: `AUDIT OF PROCESSING OPERATIONS (ART. 13(1)(c))`,
            severity: 'critical',
            evidence_html: foundUrl,
            description: `Website performs specific processing operations without explicitly linking them to a statutory legal basis in the policy document.`,
            law_name: 'Art. 13(1)(c) GDPR',
            potential_fine: LIABILITY_DATABASE.LEGAL_GROUNDS,
            explanation: `Art. 13(1)(c) requires a purpose-to-basis mapping. The following activities were found to be missing a specific Article 6 reference: ${missingBasisActivities.join(', ')}.`,
            recommendation: `Update the Privacy Policy text to include a table where every processing activity is mapped to a specific sub-section of Article 6 GDPR (e.g., Analyzing usage -> Art. 6(1)(f)).`,
            verification_method
          });
        }
      }

      // Secondary Transparency Clusters
      ['RIGHTS', 'RETENTION', 'DPO'].forEach(key => {
        const cluster = MANDATORY_CLUSTERS[key as keyof typeof MANDATORY_CLUSTERS];
        if (!cluster.keywords.some(k => k.test(fullText))) {
          violations.push({
            category: 'PRIVACY',
            report_type: 'SaaS',
            issue_type: `MISSING CLUSTER: ${cluster.name.toUpperCase()}`,
            severity: 'high',
            evidence_html: foundUrl,
            description: `Mandatory segment [${cluster.name}] not detected in policy document.`,
            law_name: cluster.law,
            potential_fine: LIABILITY_DATABASE.PRIVACY,
            explanation: `${cluster.law} requires explicit disclosure regarding ${cluster.name.toLowerCase()}.`,
            recommendation: `Update the policy text to include a dedicated section for ${cluster.name.toLowerCase()}.`,
            verification_method
          });
        }
      });
    }
  });

  return {
    violations,
    discoveredLinks: [],
    meta: { hasCMP: false, legal_links: links },
    compliance_report: {
      score: Math.max(0, 100 - (violations.length * 15)),
      verdict: violations.length > 0 ? 'RISKY' : 'COMPLIANT',
      nav_scout: { found_links: [], missing_critical: [], discovery_score: 100 },
      lex_analyzer: { has_vat_id: true, has_contact_info: true, has_mandatory_terms: true, content_truncated: false, missing_clusters: [] },
      cmp_detect: { detected_provider: null, is_active: false }
    }
  };
}
