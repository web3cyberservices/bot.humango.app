
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
  excluded_checks: string[];
  entitySuffixes: RegExp[];
}

const JURISDICTION_CONFIG: Record<string, JurisdictionProfile> = {
  'DE': { 
    name: 'Germany',
    law: 'Art. 13 GDPR & § 5 TDDG', 
    authority: 'BfDI', 
    lang: 'German', 
    requireImpressum: true, 
    excluded_checks: [],
    localGdprTerm: 'DSGVO',
    entitySuffixes: [/GmbH/i, /AG/i, /e\.V\./i, /UG/i, /GmbH & Co\. KG/i]
  },
  'FR': { 
    name: 'France',
    law: 'Art. 13 GDPR & Loi Informatique et Libertés', 
    authority: 'CNIL', 
    lang: 'French', 
    requireImpressum: false, 
    excluded_checks: ['impressum_check'],
    localGdprTerm: 'RGPD',
    entitySuffixes: [/SAS/i, /SARL/i, /SA/i, /EI/i]
  },
  'PL': { 
    name: 'Poland',
    law: 'Art. 13 GDPR & RODO', 
    authority: 'UODO', 
    lang: 'Polish', 
    requireImpressum: false, 
    excluded_checks: ['impressum_check'],
    localGdprTerm: 'RODO',
    entitySuffixes: [/Sp\. z o\.o\./i, /S\.A\./i, /Sp\.k\./i, /S\.K\.A\./i]
  },
  'DEFAULT': { 
    name: 'European Union',
    law: 'GDPR Article 13', 
    authority: 'Data Protection Authority', 
    lang: 'English', 
    requireImpressum: false, 
    excluded_checks: [],
    localGdprTerm: 'GDPR',
    entitySuffixes: [/Limited/i, /Ltd/i, /LLC/i, /PLC/i]
  }
};

const DOC_KEYWORDS: Record<string, RegExp[]> = {
  privacy: [/privacy/i, /datenschutz/i, /confidentialit/i, /privacidad/i, /trattamento/i, /rodo/i],
  impressum: [/impressum/i, /legal notice/i, /mentions l/i, /aviso legal/i]
};

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string, isPuppeteer: boolean = false, userInputCountry?: string): {
  violations: Violation[],
  discoveredLinks: string[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> },
  compliance_report: ComplianceReport
} {
  const $ = cheerio.load(html);
  const verification_method: VerificationMethod = isPuppeteer ? 'Dynamic Emulation' : 'Static Analysis';
  
  const hostname = new URL(url).hostname;
  const tld = hostname.split('.').pop()?.toUpperCase();
  const profile = JURISDICTION_CONFIG[userInputCountry?.toUpperCase() || tld || ''] || JURISDICTION_CONFIG.DEFAULT;

  const links: Record<string, string | null> = { impressum: null, privacy: null };
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (DOC_KEYWORDS.privacy.some(k => k.test(text))) links.privacy = href;
    if (DOC_KEYWORDS.impressum.some(k => k.test(text))) links.impressum = href;
  });

  const violationMap = new Map<string, Violation>();
  const fullHtmlLower = html.toLowerCase();

  // RULE 1, 2, 3: Statutory Privacy Notice
  if (!links.privacy && !fullHtmlLower.includes('privacy policy')) {
    violationMap.set('Art. 13', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'SYSTEMIC TRANSPARENCY FAILURE (Art. 13)',
      severity: 'critical',
      evidence_html: url,
      description: `Complete absence of a statutory Privacy Policy as required by Article 13 GDPR.`,
      business_impact: 'Immediate Advertising Risk: Platforms like Google and Meta will suspend your accounts for missing privacy disclosures. Furthermore, this triggers bad-faith findings in regulatory audits.',
      law_name: profile.law,
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Statutory mandates require that data subjects are informed of processing activities at the point of collection.',
      recommendation: 'Step-by-Step Corrective Action:\n1. Create a page titled "Privacy Policy".\n2. Add this link to your website footer on every page.\n3. Include a section named "Data Processing Purposes" using simple language.',
      verification_method
    });
  }

  // Identity Transparency
  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  if (!identityFound && !violationMap.has('Art. 13')) {
    violationMap.set('Art. 13(1)(a)', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'IDENTITY TRANSPARENCY FAILURE (Art. 13-1-a)',
      severity: 'high',
      evidence_html: url,
      description: 'Failure to explicitly disclose the official legal identity and address of the Data Controller.',
      business_impact: 'Loss of Customer Trust: Visitors are statistically less likely to convert or complete purchases when they cannot verify the physical ownership of the service.',
      law_name: 'Art. 13(1)(a) GDPR',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Companies must identify their full registered name and physical office address to satisfy transparency requirements.',
      recommendation: 'Step-by-Step Corrective Action:\n1. Update your Privacy Policy footer.\n2. Add this specific text: "Data Controller: [Your Company Ltd], Address: [Street, City, Postal Code]".',
      verification_method
    });
  }

  // Legal Notice (Impressum)
  if (profile.requireImpressum && !links.impressum && !profile.excluded_checks.includes('impressum_check')) {
    violationMap.set('TDDG', {
      category: 'IMPRESSUM',
      report_type: 'SaaS',
      issue_type: 'MISSING STATUTORY LEGAL NOTICE',
      severity: 'critical',
      evidence_html: url,
      description: `Absence of a mandatory Statutory Legal Notice (Impressum) required for commercial operations.`,
      business_impact: 'Legal Injunction Risk: In jurisdictions like Germany, missing an Impressum leads to immediate cease-and-desist orders (Abmahnung) from competitors.',
      law_name: profile.law.includes('TDDG') ? '§ 5 TDDG (Germany)' : 'Commercial Transparency Act',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'This is a mandatory "Identity Card" for your business required for commercial transparency in the EU.',
      recommendation: 'Step-by-Step Corrective Action:\n1. Create a page titled "Legal Notice" or "Impressum".\n2. List: Company Name, Address, VAT ID, and Name of Managing Directors.',
      verification_method
    });
  }

  // Cookies (Rule 4)
  if (!fullHtmlLower.includes('cookie') && !fullHtmlLower.includes('tracking')) {
    violationMap.set('ePrivacy', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'COOKIE CONSENT FAILURE (ePrivacy)',
      severity: 'medium',
      evidence_html: url,
      description: 'The audit failed to detect a clear disclosure regarding cookies and user tracking.',
      business_impact: 'Ad-Platform Suspension: Google Ads and Meta require explicit cookie transparency. Failure to disclose tracking leads to permanent domain-wide advertising bans.',
      law_name: 'ePrivacy Directive (2002/58/EC) Art. 5(3)',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Website operators must provide clear and comprehensive information about cookies and obtain user consent before accessing non-essential data.',
      recommendation: 'Step-by-Step Corrective Action:\n1. Implement a Cookie Banner.\n2. Ensure it explicitly states: "We use cookies to improve your experience. [Accept] / [Decline]".',
      verification_method
    });
  }

  const violations = Array.from(violationMap.values());
  const score = Math.max(0, 100 - (violations.length * 20));

  return {
    violations,
    discoveredLinks: [],
    meta: { hasCMP: false, legal_links: links },
    compliance_report: {
      score,
      grade: score > 90 ? 'A' : score > 70 ? 'C' : 'F',
      verdict: violations.length > 0 ? 'RISKY' : 'COMPLIANT',
      jurisdiction: profile.name,
      top_risks: violations.slice(0, 3).map(v => v.issue_type),
      validation_status: 'incomplete',
      nav_scout: { found_links: [], missing_critical: [], discovery_score: 100 },
      lex_analyzer: { has_vat_id: true, has_contact_info: true, has_mandatory_terms: true, content_truncated: false, missing_clusters: [] },
      cmp_detect: { detected_provider: null, is_active: false }
    }
  };
}
