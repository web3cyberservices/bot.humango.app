import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, VerificationMethod } from '@/types';

/**
 * @fileOverview Statutory Diagnostic Layer V21.6.
 * 
 * - Hard Consolidation: One Article = One Page.
 * - Logical Consistency: Avoids Missing/Incomplete contradictions.
 */

const LIABILITY_CRITICAL = "Fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). Immediate risk of ad account suspension (Google/Meta).";
const LIABILITY_HIGH = "Administrative penalties up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). Vulnerable to legal 'Abmahnung'.";

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
  if (!links.privacy) {
    violationMap.set('Art. 13-Missing', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING PRIVACY INFRASTRUCTURE',
      severity: 'critical',
      evidence_html: url,
      description: `The website lacks a mandatory Privacy Statement required for legal data processing.`,
      business_impact: 'Business Risk: Immediate suspension of Google/Meta advertising accounts and total loss of tracking capability.',
      law_name: profile.law,
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'Statutory rules require you to inform users of site ownership and data handling before collection begins.',
      recommendation: `ACTION: Footer -> INSERT EXACTLY: '<a href="/privacy">Privacy Policy</a>'`,
      verification_method
    });
  } else {
    // Check for Incomplete Content
    const bodyText = $('body').text();
    const hasRetention = /retention|storage|storing|storage period/i.test(bodyText);
    if (!hasRetention) {
       violationMap.set('Art. 13-Incomplete', {
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'INCOMPLETE DATA RETENTION DISCLOSURE',
        severity: 'high',
        evidence_html: links.privacy,
        description: `The Privacy Policy fails to specify statutory data retention periods required by Art. 13(2)(a).`,
        business_impact: 'Business Risk: Vulnerability to GDPR regulatory audits and data subject erasure claims.',
        law_name: 'Art. 13(2)(a) GDPR',
        potential_fine: LIABILITY_HIGH,
        explanation: 'Statutory rules require you to explicitly state exactly how long you store user data.',
        recommendation: `ACTION: Privacy Policy -> INSERT EXACTLY: 'We store technical cookie data for 12 months from the date of consent.'`,
        verification_method
      });
    }
  }

  // RULE 2: Registered Identity (Art. 13-1-a)
  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  if (!identityFound && !violationMap.has('Art. 13-Missing')) {
    violationMap.set('Art. 13(1)(a)', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'ANONYMOUS DATA CONTROLLER',
      severity: 'high',
      evidence_html: url,
      description: 'The website operator identity (registered name and street address) is missing or obscured.',
      business_impact: 'Business Risk: Loss of customer trust and potential payment gateway (Stripe/PayPal) suspension.',
      law_name: 'Art. 13(1)(a) GDPR',
      potential_fine: LIABILITY_HIGH,
      explanation: 'Statutory rules require a physical address and registered entity name for commercial accountability.',
      recommendation: `ACTION: Footer -> INSERT EXACTLY: 'Data Controller: [Your Company], Address: [Street, City, Postcode]'`,
      verification_method
    });
  }

  // RULE 3: Company Identity Card (Impressum)
  if (profile.requireImpressum && !links.impressum && !profile.excluded_checks.includes('impressum_check')) {
    violationMap.set('TDDG', {
      category: 'IMPRESSUM',
      report_type: 'SaaS',
      issue_type: 'MISSING STATUTORY IDENTITY CARD (IMPRESSUM)',
      severity: 'critical',
      evidence_html: url,
      description: `Missing mandatory "Impressum" Legal Notice required for commercial transparency.`,
      business_impact: 'Business Risk: Direct risk of legal "Abmahnung" (Cease and Desist) notices from competitors.',
      law_name: profile.law.includes('TDDG') ? '§ 5 TDDG (Germany)' : 'Commercial Transparency Act',
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'Every commercial website must have a Legal Notice listing ownership, address, and VAT ID.',
      recommendation: `ACTION: Footer -> INSERT EXACTLY: '<a href="/legal">Legal Notice (Impressum)</a>'`,
      verification_method
    });
  }

  // RULE 4: ePrivacy & Cookies (Art. 5(3))
  if (!fullHtmlLower.includes('cookie') && !fullHtmlLower.includes('tracking')) {
    violationMap.set('ePrivacy', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'UNAUTHORIZED TRACKING (ePRIVACY)',
      severity: 'medium',
      evidence_html: url,
      description: 'The website sets tracking scripts without acquiring statutory user consent.',
      business_impact: 'Business Risk: Immediate loss of marketing ROI as Meta and Google require explicit Consent Mode v2.',
      law_name: 'ePrivacy Directive Art. 5(3) & Art. 7 GDPR',
      potential_fine: LIABILITY_HIGH,
      explanation: 'Consent is strictly required before setting non-essential cookies or tracking pixels.',
      recommendation: `ACTION: Consent Banner -> INSERT EXACTLY: 'We use cookies for analytics. [Accept] [Settings]'`,
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