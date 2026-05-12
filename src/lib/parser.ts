import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, VerificationMethod } from '@/types';

const LIABILITY_CRITICAL = "Fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). High risk of immediate regulatory intervention.";
const LIABILITY_HIGH = "Administrative fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR).";

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
      issue_type: 'MISSING PRIVACY INFRASTRUCTURE',
      severity: 'critical',
      evidence_html: url,
      description: `The website lacks a mandatory Privacy Statement required for legal data processing.`,
      business_impact: 'Business Risk: Immediate suspension of advertising accounts (Google Ads, Meta Ads) and total loss of marketing tracking capability.',
      law_name: profile.law,
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'GDPR Art. 13 requires companies to inform users of who owns the website and how data is handled before collection begins.',
      recommendation: `FIX: Footer -> Insert this text: 'Privacy Policy: [Link to Document], Data Controller: ${hostname}, Contact: support@${hostname}'`,
      verification_method
    });
  }

  // RULE 2: Registered Identity (Art. 13-1-a)
  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  if (!identityFound && !violationMap.has('Art. 13')) {
    violationMap.set('Art. 13(1)(a)', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'ANONYMOUS DATA CONTROLLER',
      severity: 'high',
      evidence_html: url,
      description: 'The website operator identity (registered name and street address) is missing or obscured.',
      business_impact: 'Business Risk: Loss of B2B trust and potential payment gateway (Stripe/PayPal) suspension due to identity verification failure.',
      law_name: 'Art. 13(1)(a) GDPR',
      potential_fine: LIABILITY_HIGH,
      explanation: 'Statutory rules require a physical street address and registered entity name for commercial accountability.',
      recommendation: `FIX: Contact Page -> Insert this text: 'Official Operator: [Your Legal Entity Name], Registered Address: [Your Full Street Address]'`,
      verification_method
    });
  }

  // RULE 3: Company Identity Card (Impressum)
  if (profile.requireImpressum && !links.impressum && !profile.excluded_checks.includes('impressum_check')) {
    violationMap.set('TDDG', {
      category: 'IMPRESSUM',
      report_type: 'SaaS',
      issue_type: 'MISSING COMPANY IDENTITY CARD (IMPRESSUM)',
      severity: 'critical',
      evidence_html: url,
      description: `Missing mandatory "Impressum" Legal Notice required for commercial transparency in the EU.`,
      business_impact: 'Business Risk: Legal "Abmahnung" (Cease and Desist) risk from EU competitors. Direct vulnerability to specialized litigation bots.',
      law_name: profile.law.includes('TDDG') ? '§ 5 TDDG (Germany)' : 'Commercial Transparency Act',
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'Every commercial website in jurisdictions like Germany must have an Impressum listing the owner and VAT ID.',
      recommendation: `FIX: Legal Notice Page -> Insert this text: 'Managing Director: [Names], VAT ID: [Your ID], Registration: [City/Court]'`,
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
      description: 'The website sets tracking scripts without acquiring statutory user consent first.',
      business_impact: 'Business Risk: Total loss of marketing ROI as Meta and Google now require explicit "Consent Mode v2" for tracking.',
      law_name: 'ePrivacy Directive Art. 5(3) & Art. 7 GDPR',
      potential_fine: LIABILITY_HIGH,
      explanation: 'Legal consent is strictly required before setting any non-essential cookies or tracking pixels.',
      recommendation: `FIX: Cookie Banner -> Insert this text: 'We use cookies to analyze traffic. We store your choice for exactly 12 months.'`,
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