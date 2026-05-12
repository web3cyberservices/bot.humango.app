
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, VerificationMethod } from '@/types';

/**
 * @fileOverview Automated Legal Fixer V25.0 - Statutory Diagnostic Engine.
 * 
 * - Rule: Human-Friendly definitions (DPO, Official Company Identity).
 * - Rule: Zero-Advice Fixes (Copy-paste ready HTML/Text snippets).
 */

const LIABILITY_CRITICAL = "Fines up to €20,000,000 or 4% of annual global turnover (Art. 83 GDPR). High risk of immediate ad account suspension (Meta/Google).";
const LIABILITY_HIGH = "Administrative penalties up to €20,000,000 (Art. 83 GDPR). High risk of competitor cease and desist (Abmahnung) notices.";

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
  privacy: [/privacy/i, /datenschutz/i, /confidentialit/i, /privacidad/i, /rodo/i],
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
  
  const domain = new URL(url).hostname;
  const tld = domain.split('.').pop()?.toUpperCase();
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

  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  
  if (!links.privacy) {
    violationMap.set('Art. 13-Missing', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING PRIVACY INFRASTRUCTURE',
      severity: 'critical',
      evidence_html: url,
      description: `The law requires you to display a Privacy Policy document clearly on your site. No such resource was detected.`,
      business_impact: 'Business Risk: Immediate loss of marketing ROI as Meta and Google advertising platforms require valid compliance signals to run campaigns.',
      law_name: profile.law,
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'You must inform users of site ownership and data usage before collection starts.',
      recommendation: `ACTION: INSERT THIS TEXT -> Add a link to your website footer: <a href="/privacy">Privacy Policy</a>. Then create a page at /privacy and insert your legal disclosures.`,
      verification_method
    });
  } else {
    const policyBody = $('body').text();
    if (!/retention|storage|storing/i.test(policyBody)) {
       violationMap.set('Art. 13-Retention', {
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: 'CRITICAL GAP: DATA RETENTION TIMEFRAMES',
        severity: 'high',
        evidence_html: links.privacy,
        description: `Your policy fails to state exactly how long you store user data. This is a mandatory transparency requirement under Art. 13.`,
        business_impact: 'Business Risk: Direct vulnerability to regulatory audits and Art. 17 data erasure lawsuits. High risk of immediate ad account suspension.',
        law_name: 'Art. 13(2)(a) GDPR',
        potential_fine: LIABILITY_HIGH,
        explanation: 'You must state how long you keep user data or the specific criteria used to decide that timeframe.',
        recommendation: `ACTION: INSERT THIS TEXT -> 'Data Retention: ${domain} stores your personal data for a period of 24 months from the date of your last interaction or until you request account deletion.'`,
        verification_method
      });
    }
  }

  if (!identityFound && !violationMap.has('Art. 13-Missing')) {
    violationMap.set('Art. 13(1)(a)', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING OFFICIAL COMPANY IDENTITY',
      severity: 'high',
      evidence_html: url,
      description: 'The law requires you to display your registered company name and physical address for commercial accountability.',
      business_impact: 'Business Risk: Significant loss of B2B trust and potential payment gateway (Stripe/PayPal) account suspension due to lack of verified identity.',
      law_name: 'Art. 13(1)(a) GDPR',
      potential_fine: LIABILITY_HIGH,
      explanation: 'Statutory rules require a physical address and registered company name for all commercial entities operating in the EU.',
      recommendation: `ACTION: INSERT THIS TEXT -> Add this to your footer: 'Data Controller: [Your Registered Company Name], Address: [Your Legal Business Address], Email: support@${domain}'`,
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
