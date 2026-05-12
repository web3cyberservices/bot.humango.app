
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, VerificationMethod } from '@/types';

const LIABILITY_STANDARD = 'Potential Administrative Liability: Up to €20,000,000 or 4% of annual global turnover (Art. 83 GDPR)';

interface JurisdictionProfile {
  name: string;
  law: string;
  authority: string;
  lang: string;
  localGdprTerm: string;
  requireImpressum: boolean;
  entitySuffixes: RegExp[];
  phonePrefixes: string[];
}

const JURISDICTION_CONFIG: Record<string, JurisdictionProfile> = {
  'DE': { 
    name: 'Germany',
    law: 'Art. 13 GDPR & § 5 TDDG', 
    authority: 'BfDI', 
    lang: 'German', 
    requireImpressum: true, 
    localGdprTerm: 'DSGVO',
    entitySuffixes: [/GmbH/i, /AG/i, /e\.V\./i, /UG/i, /GmbH & Co\. KG/i],
    phonePrefixes: ['+49', '0049']
  },
  'FR': { 
    name: 'France',
    law: 'Art. 13 GDPR & Loi Informatique et Libertés', 
    authority: 'CNIL', 
    lang: 'French', 
    requireImpressum: false, 
    localGdprTerm: 'RGPD',
    entitySuffixes: [/SAS/i, /SARL/i, /SA/i, /EI/i],
    phonePrefixes: ['+33', '0033']
  },
  'PL': { 
    name: 'Poland',
    law: 'Art. 13 GDPR & RODO', 
    authority: 'UODO', 
    lang: 'Polish', 
    requireImpressum: false, 
    localGdprTerm: 'RODO',
    entitySuffixes: [/Sp\. z o\.o\./i, /S\.A\./i, /Sp\.k\./i, /S\.K\.A\./i],
    phonePrefixes: ['+48', '0048']
  },
  'DEFAULT': { 
    name: 'European Union',
    law: 'GDPR Article 13', 
    authority: 'Data Protection Authority', 
    lang: 'English', 
    requireImpressum: false, 
    localGdprTerm: 'GDPR',
    entitySuffixes: [/Limited/i, /Ltd/i, /LLC/i, /PLC/i],
    phonePrefixes: []
  }
};

const DOC_KEYWORDS: Record<string, RegExp[]> = {
  privacy: [
    /privacy/i, /datenschutz/i, /confidentialit/i, /privacidad/i, /trattamento/i, 
    /privacyverklaring/i, /polityka prywatno/i, /rodo/i, /tietosuojaseloste/i, 
    /integritetspolicy/i, /zásady ochrany/i, /privatlivspolitik/i, /privatumo politika/i
  ],
  impressum: [
    /impressum/i, /legal notice/i, /mentions l/i, /aviso legal/i, /note legali/i, 
    /rechtliche hinweise/i, /mentions légales/i, /colofon/i, /aviso legal/i
  ]
};

const PROCESSING_PURPOSES = [
  { id: 'analytics', name: 'Usage Analysis & Optimization', keywords: [/analytics/i, /tracking/i, /analyse/i, /analityka/i, /pixels/i, /matomo/i, /hotjar/i], defaultBasis: 'Art. 6(1)(f)' },
  { id: 'security', name: 'Security & Fraud Prevention', keywords: [/fraud/i, /security/i, /s[ée]curit[ée]/i, /oszustwom/i, /firewall/i], defaultBasis: 'Art. 6(1)(f)' },
  { id: 'marketing', name: 'Direct Marketing & Advertising', keywords: [/marketing/i, /advertising/i, /publicit[ée]/i, /publicidad/i, /adsense/i], defaultBasis: 'Art. 6(1)(a)' },
  { id: 'support', name: 'Customer Support & Contact', keywords: [/support/i, /contact/i, /kontakt/i, /hilfe/i], defaultBasis: 'Art. 6(1)(b)' }
];

function detectJurisdiction(html: string, url: string, userInput?: string): JurisdictionProfile {
  if (userInput && JURISDICTION_CONFIG[userInput.toUpperCase()]) {
    return JURISDICTION_CONFIG[userInput.toUpperCase()];
  }
  const fullText = html.substring(0, 50000);
  const hostname = new URL(url).hostname;
  for (const [code, profile] of Object.entries(JURISDICTION_CONFIG)) {
    if (profile.entitySuffixes.some(s => s.test(fullText))) return profile;
  }
  const tld = hostname.split('.').pop()?.toUpperCase();
  if (tld && JURISDICTION_CONFIG[tld]) return JURISDICTION_CONFIG[tld];
  return JURISDICTION_CONFIG.DEFAULT;
}

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string, isPuppeteer: boolean = false, userInputCountry?: string): {
  violations: Violation[],
  discoveredLinks: string[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> },
  compliance_report: ComplianceReport
} {
  const $ = cheerio.load(html);
  const verification_method: VerificationMethod = isPuppeteer ? 'Dynamic Emulation' : 'Static Analysis';
  const profile = detectJurisdiction(html, url, userInputCountry);
  const links: Record<string, string | null> = { impressum: null, privacy: null };
  
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
    if (DOC_KEYWORDS.privacy.some(k => k.test(text))) links.privacy = href;
    if (DOC_KEYWORDS.impressum.some(k => k.test(text))) links.impressum = href;
  });

  const violationMap = new Map<string, Violation>();
  const fullHtmlLower = html.toLowerCase();
  const footerText = $('footer').text().toLowerCase();

  const reportedArticles = new Set<string>();

  // 1. SYSTEMIC TRANSPARENCY (Art. 13)
  if (!links.privacy && !fullHtmlLower.includes('privacy policy') && !fullHtmlLower.includes(profile.localGdprTerm.toLowerCase())) {
    const article = 'Art. 13';
    if (!reportedArticles.has(article)) {
      violationMap.set(article, {
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'SYSTEMIC TRANSPARENCY FAILURE (Art. 13)',
        severity: 'critical',
        evidence_html: url,
        description: `Our legal diagnostic confirmed a critical failure: the domain completely lacks a statutory Privacy Policy. Under Article 13, website operators must provide transparent information at the moment of data collection.`,
        business_impact: 'Vulnerability to complaints: Any dissatisfied client or visitor can file a complaint with their local regulator, which triggers a mandatory audit and high risk of administrative fines.',
        law_name: profile.law,
        potential_fine: LIABILITY_STANDARD,
        explanation: 'GDPR Article 13 requires companies to explicitly inform data subjects of their rights when collecting personal data.',
        recommendation: '1. Create a dedicated Privacy Policy page.\n2. Add a clear link to the policy in the website footer.\n3. Ensure the policy explicitly lists all processing activities, legal bases, and user rights.',
        verification_method
      });
      reportedArticles.add(article);
    }
  }

  // 2. CONTROLLER IDENTITY (Art. 13-1-a)
  const identityInFooter = profile.entitySuffixes.some(s => s.test(footerText));
  const identityInDocument = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  const article131a = 'Art. 13(1)(a)';

  if (!reportedArticles.has(article131a)) {
    if (!identityInDocument && !identityInFooter) {
      violationMap.set(article131a, {
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'CONTROLLER IDENTITY FAILURE (Art. 13-1-a)',
        severity: 'high',
        evidence_html: url,
        description: `The audit infrastructure failed to identify the official legal identity of the Data Controller. This includes the registered legal name, physical office address, and registration identifier.`,
        business_impact: 'Loss of trust: Customers are significantly more hesitant to leave data or make purchases when they cannot identify the legal owner. This directly leads to lower conversion rates.',
        law_name: 'Art. 13(1)(a) GDPR',
        potential_fine: LIABILITY_STANDARD,
        explanation: 'Article 13(1)(a) requires that the identity and contact details of the controller are provided to the data subject.',
        recommendation: '1. Specify the official legal entity name (e.g., "Company Name Ltd").\n2. Provide the registered office address and a valid electronic contact method.\n3. Include the company registration number.',
        verification_method
      });
      reportedArticles.add(article131a);
    } else if (identityInFooter && !identityInDocument && links.privacy) {
      violationMap.set(article131a, {
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'PARTIAL IDENTITY TRANSPARENCY (Art. 13-1-a)',
        severity: 'medium',
        evidence_html: url,
        description: 'Identity markers were found in the website footer, but these specific details are missing from the formal Transparency Disclosure (Privacy Policy).',
        business_impact: 'Accountability risk: Fragmented legal information can be interpreted by regulators as a deliberate lack of transparency, increasing the likelihood of bad-faith audit findings.',
        law_name: 'Art. 13(1)(a) GDPR',
        potential_fine: LIABILITY_STANDARD,
        explanation: 'Consolidating identity information within the Privacy Policy ensures that data subjects can identify the responsible entity without searching multiple site sub-pages.',
        recommendation: '1. Transfer the legal entity name and address from the footer into the "Controller" section of the Privacy Policy.\n2. Ensure contact details match exactly across all legal documents.',
        verification_method
      });
      reportedArticles.add(article131a);
    }
  }

  // 3. RETENTION PERIODS (Art. 13-2-a)
  const article132a = 'Art. 13(2)(a)';
  if (!fullHtmlLower.includes('retention') && !fullHtmlLower.includes('storage period') && links.privacy && !reportedArticles.has(article132a)) {
    violationMap.set(article132a, {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING RETENTION FRAMEWORK (Art. 13-2-a)',
      severity: 'high',
      evidence_html: links.privacy || url,
      description: 'The Privacy Policy fails to disclose how long personal data will be stored or the criteria used to determine that period.',
      business_impact: 'Compliance risk: Storing user data indefinitely without a declared retention strategy is a major GDPR violation (Storage Limitation) and a primary target for regulatory scrutiny.',
      law_name: 'Art. 13(2)(a) GDPR',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Companies must explicitly inform subjects of the time period for which personal data will be stored.',
      recommendation: '1. Define specific storage durations for different data types.\n2. If duration cannot be fixed, explain the criteria (e.g., "Data is kept as required by statutory limitation periods").',
      verification_method
    });
    reportedArticles.add(article132a);
  }

  // 4. PURPOSE-TO-BASIS CORRELATION (Art. 13-1-c)
  const activeProcessing = PROCESSING_PURPOSES.filter(p => p.keywords.some(k => k.test(fullHtmlLower)));
  if (activeProcessing.length > 0) {
    const article131c = 'Art. 13(1)(c)';
    const hasLegalBasisSection = fullHtmlLower.includes('legal basis') || fullHtmlLower.includes('article 6') || fullHtmlLower.includes('art. 6');

    if (!hasLegalBasisSection && !reportedArticles.has(article131c)) {
      violationMap.set(article131c, {
        category: 'LEGAL_GROUNDS',
        report_type: 'SaaS',
        issue_type: 'LEGAL BASIS CORRELATION FAILURE (Art. 13-1-c)',
        severity: 'high',
        evidence_html: links.privacy || url,
        description: `The site performs processing (e.g., ${activeProcessing.map(p => p.name).join(', ')}) but fails to explicitly link these activities to the mandatory legal bases in Article 6.`,
        business_impact: 'Risk of blocking: Modern advertising platforms like Google and Meta may suspend business accounts that fail to explicitly declare the legal basis for their tracking activities.',
        law_name: 'Art. 13(1)(c) GDPR',
        potential_fine: LIABILITY_STANDARD,
        explanation: 'Every processing activity must be explicitly linked to one of the six legal bases from Article 6 GDPR.',
        recommendation: '1. Map every processing purpose to its statutory basis (e.g., "Analytics: Art. 6(1)(f)").\n2. Update the Privacy Policy to include a clear table of purposes and bases.',
        verification_method
      });
      reportedArticles.add(article131c);
    }
  }

  // 5. DATA SUBJECT RIGHTS (Art. 13-2-b)
  const article132b = 'Art. 13(2)(b)';
  const rightsKeywords = [/right of access/i, /right to erasure/i, /right to rectification/i, /right to portability/i];
  const hasRights = rightsKeywords.some(k => k.test(fullHtmlLower));
  if (!hasRights && links.privacy && !reportedArticles.has(article132b)) {
    violationMap.set(article132b, {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING DATA SUBJECT RIGHTS (Art. 13-2-b)',
      severity: 'high',
      evidence_html: links.privacy || url,
      description: 'The transparency disclosure fails to inform users of their mandatory rights, including access, erasure ("right to be forgotten"), and data portability.',
      business_impact: 'Enforcement risk: Failing to inform users of their rights is a top reason for heavy fines, as it directly hinders the user\'s ability to control their personal data.',
      law_name: 'Art. 13(2)(b) GDPR',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'GDPR Article 13(2)(b) requires companies to explicitly inform subjects of their rights: access, rectification, erasure, and portability.',
      recommendation: '1. Add a dedicated "Your Rights" section to the Privacy Policy.\n2. Explicitly list all statutory rights and provide a contact method to exercise them.',
      verification_method
    });
    reportedArticles.add(article132b);
  }

  // 6. JURISDICTIONAL SPECIFICS (Impressum)
  if (profile.requireImpressum && !links.impressum && !fullHtmlLower.includes('impressum')) {
    const articleImpressum = 'Statutory Legal Notice';
    if (!reportedArticles.has(articleImpressum)) {
      violationMap.set(articleImpressum, {
        category: 'IMPRESSUM',
        report_type: 'SaaS',
        issue_type: 'MISSING STATUTORY LEGAL NOTICE (TDDG)',
        severity: 'critical',
        evidence_html: url,
        description: `The audit confirmed the total absence of a 'Statutory Legal Notice' (Impressum), mandatory for entities in ${profile.name}.`,
        business_impact: 'Commercial risk: In Germany, missing an Impressum allows competitors or legal groups to file "Abmahnung" lawsuits, leading to immediate legal costs and injunctions.',
        law_name: '§ 5 TDDG (Germany)',
        potential_fine: LIABILITY_STANDARD,
        explanation: 'Statutory transparency laws require specific identity and contact information to be provided in a consolidated legal notice.',
        recommendation: '1. Create a dedicated "Legal Notice" or "Impressum" page.\n2. Include the official company name, registered address, directors, registration number, and VAT ID.',
        verification_method
      });
      reportedArticles.add(articleImpressum);
    }
  }

  // 7. COOKIE TRANSPARENCY
  const articleCookie = 'Cookie Transparency';
  if (!fullHtmlLower.includes('cookie policy') && !fullHtmlLower.includes('cookies') && !reportedArticles.has(articleCookie)) {
    violationMap.set(articleCookie, {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'COOKIE DISCLOSURE FAILURE (ePrivacy)',
      severity: 'medium',
      evidence_html: url,
      description: 'The site does not provide clear information about the use of cookies or tracking technologies.',
      business_impact: 'Ad Account Risk: Advertising networks (Google, Meta, LinkedIn) strictly require clear cookie disclosures and user consent for tracking pixels to operate legally.',
      law_name: 'ePrivacy Directive (2002/58/EC)',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Website operators must provide clear information and obtain user consent before storing non-essential cookies.',
      recommendation: '1. Implement a clear Cookie Disclosure.\n2. Detail the purpose of each cookie type (Essential, Marketing, Analytical).',
      verification_method
    });
    reportedArticles.add(articleCookie);
  }

  const violations = Array.from(violationMap.values());
  const score = Math.max(0, 100 - (violations.length * 15));
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (score > 90) grade = 'A';
  else if (score > 80) grade = 'B';
  else if (score > 70) grade = 'C';
  else if (score > 60) grade = 'D';

  return {
    violations,
    discoveredLinks: [],
    meta: { hasCMP: false, legal_links: links },
    compliance_report: {
      score,
      grade,
      verdict: violations.length > 0 ? 'RISKY' : 'COMPLIANT',
      jurisdiction: profile.name,
      top_risks: violations.slice(0, 3).map(v => v.issue_type),
      nav_scout: { found_links: Object.values(links).filter(Boolean) as string[], missing_critical: [], discovery_score: 100 },
      lex_analyzer: { has_vat_id: true, has_contact_info: true, has_mandatory_terms: true, content_truncated: false, missing_clusters: [] },
      cmp_detect: { detected_provider: null, is_active: false },
      validation_status: 'incomplete'
    }
  };
}
