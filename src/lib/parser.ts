
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

  // RULE 1: Statutory Privacy Notice (Art. 13)
  if (!links.privacy && !fullHtmlLower.includes('privacy policy')) {
    violationMap.set('Art. 13', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'SYSTEMIC TRANSPARENCY FAILURE (Art. 13)',
      severity: 'critical',
      evidence_html: url,
      description: `Complete absence of a mandatory Privacy Policy as required by Article 13 GDPR.`,
      business_impact: 'Business Risk: Loss of Customer Trust. Visitors are significantly less likely to share data if they don\'t know who is in charge of it, causing an immediate drop in conversions.',
      law_name: profile.law,
      potential_fine: LIABILITY_STANDARD,
      explanation: 'Every website collecting user data must inform them about processing activities via a clear, linked policy.',
      recommendation: `FIX: Add this text to your footer: 'Data Controller: ${hostname}, Registered Address: [Your Address], Contact: [Your Email]'.`,
      verification_method
    });
  }

  // RULE 2: Identity Transparency (Art. 13-1-a)
  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  if (!identityFound && !violationMap.has('Art. 13')) {
    violationMap.set('Art. 13(1)(a)', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'IDENTITY TRANSPARENCY FAILURE (Art. 13-1-a)',
      severity: 'high',
      evidence_html: url,
      description: 'Failure to disclose the official registered name and address of the entity responsible for the website.',
      business_impact: 'Business Risk: Regulatory Anonymity. Failure to identify the owner makes your business a prime target for competitor complaints and audits by local Data Protection Authorities.',
      law_name: 'Art. 13(1)(a) GDPR',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'You must show exactly who is in charge of the data. This means a full company name and a physical address.',
      recommendation: "FIX: Add your full legal entity name and registered office address to your 'Contact' or 'Impressum' page.",
      verification_method
    });
  }

  // RULE 3: Statutory Legal Notice (Impressum)
  if (profile.requireImpressum && !links.impressum && !profile.excluded_checks.includes('impressum_check')) {
    violationMap.set('TDDG', {
      category: 'IMPRESSUM',
      report_type: 'SaaS',
      issue_type: 'MISSING STATUTORY LEGAL NOTICE (IMPRESSUM)',
      severity: 'critical',
      evidence_html: url,
      description: `Absence of a mandatory "Impressum" (Legal Notice) identifying the commercial owner of the website.`,
      business_impact: 'Business Risk: Legal Notice Failure. In countries like Germany, missing an Impressum often leads to immediate legal warnings (Abmahnung) from competitors costing thousands of euros.',
      law_name: profile.law.includes('TDDG') ? '§ 5 TDDG (Germany)' : 'Commercial Transparency Act',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'This is a mandatory "Identity Card" for your business required in the EU for commercial transparency.',
      recommendation: "FIX: Create a page titled 'Legal Notice' and link it globally. It must include your VAT ID, Director's names, and full business address.",
      verification_method
    });
  }

  // RULE 4: Cookies & Tracking (ePrivacy)
  if (!fullHtmlLower.includes('cookie') && !fullHtmlLower.includes('tracking')) {
    violationMap.set('ePrivacy', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'COOKIE CONSENT FAILURE (ePrivacy)',
      severity: 'medium',
      evidence_html: url,
      description: 'The site does not show a clear disclosure or consent mechanism for tracking technologies.',
      business_impact: 'Business Risk: Ad Account Suspension. Platforms like Google and Meta now require explicit proof of consent (Consent Mode v2). Without this, your advertising performance will drop.',
      law_name: 'ePrivacy Directive Art. 5(3)',
      potential_fine: LIABILITY_STANDARD,
      explanation: 'You must inform users about non-essential cookies and get their permission before setting them.',
      recommendation: "FIX: Implement a Cookie Banner and add this text: 'We store technical cookies for 12 months from the date of consent.'",
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
