
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport } from '@/types';

/**
 * @fileOverview Ultimate EU Compliance Parser v2026
 * Covers all 27 EU member states with specific national laws and regulators.
 */

const LIABILITY_GDPR = "Up to €20,000,000 or 4% of global annual turnover.";

interface NationalRule {
  country: string;
  law: string;
  regulator: string;
  fine: string;
  required_markers: RegExp[];
  optional_markers?: RegExp[];
  forbidden_markers?: RegExp[];
}

const EU_NATIONAL_RULES: Record<string, NationalRule> = {
  'DE': {
    country: 'Germany',
    law: '§ 5 DDG (Digitale-Dienste-Gesetz)',
    regulator: 'BfDI / LfD',
    fine: 'Up to €50,000 for Impressum errors; GDPR fines for others.',
    required_markers: [/handelsregister/i, /registernummer/i, /ust-idnr/i, /amtsgericht/i]
  },
  'AT': {
    country: 'Austria',
    law: '§ 5 ECG / § 25 Mediengesetz',
    regulator: 'DSB',
    fine: 'Administrative fines up to €20,000,000.',
    required_markers: [/firmenbuch/i, /uid-nummer/i, /handelsgericht/i]
  },
  'FR': {
    country: 'France',
    law: 'Loi Informatique et Libertés / CNIL Guidelines',
    regulator: 'CNIL',
    fine: 'Up to 2% - 4% of turnover.',
    required_markers: [/siret/i, /siren/i, /r.c.s/i],
    forbidden_markers: [/refuser tout/i, /continuer sans accepter/i] // Used to check symmetrical refusal
  },
  'ES': {
    country: 'Spain',
    law: 'LSSI-CE / LOPDGDD',
    regulator: 'AEPD',
    fine: 'Up to €20,000,000.',
    required_markers: [/nif/i, /cif/i, /aviso legal/i]
  },
  'IT': {
    country: 'Italy',
    law: 'DPR 633/1972 (IVA Art. 35)',
    regulator: 'Garante Privacy',
    fine: 'Administrative fines for missing P.IVA.',
    required_markers: [/partita iva/i, /p.iva/i, /\d{11}/]
  },
  'NL': {
    country: 'Netherlands',
    law: 'AVG / Telecommunicatiewet',
    regulator: 'AP',
    fine: 'Up to €20,000,000.',
    required_markers: [/kvk-nummer/i, /btw-identificatienummer/i]
  },
  'BE': {
    country: 'Belgium',
    law: 'Code de droit économique',
    regulator: 'APD-GBA',
    fine: 'Standard GDPR penalties.',
    required_markers: [/bce/i, /kbo/i, /numéro d'entreprise/i]
  },
  'PL': {
    country: 'Poland',
    law: 'RODO / Ustawa o świadczeniu usług drogą elektroniczną',
    regulator: 'UODO',
    fine: 'Up to €20,000,000.',
    required_markers: [/nip/i, /regon/i, /krs/i]
  },
  'IE': {
    country: 'Ireland',
    law: 'Data Protection Act 2018',
    regulator: 'DPC',
    fine: 'High focus on Children Code.',
    required_markers: [/cro number/i, /registered in ireland/i]
  },
  'SE': { country: 'Sweden', law: 'GDPR / Patientdatalagen', regulator: 'IMY', fine: 'GDPR Standard', required_markers: [/organisationsnummer/i] },
  'DK': { country: 'Denmark', law: 'Databeskyttelsesloven', regulator: 'Datatilsynet', fine: 'GDPR Standard', required_markers: [/cvr-nummer/i] },
  'FI': { country: 'Finland', law: 'Tietosuojalaki', regulator: 'Tietosuojavaltuutetun', fine: 'GDPR Standard', required_markers: [/y-tunnus/i] },
  'CZ': { country: 'Czechia', law: 'Zákon o ochraně osobních údajů', regulator: 'ÚOOÚ', fine: 'GDPR Standard', required_markers: [/ičo/i, /dič/i] },
  'SK': { country: 'Slovakia', law: 'Zákon o ochrane osobných údajov', regulator: 'ÚOOÚ SR', fine: 'GDPR Standard', required_markers: [/ičo/i] },
  'HU': { country: 'Hungary', law: 'Infotv.', regulator: 'NAIH', fine: 'GDPR Standard', required_markers: [/adószám/i, /cégjegyzékszám/i] },
  'RO': { country: 'Romania', law: 'Legea 190/2018', regulator: 'ANSPDCP', fine: 'GDPR Standard', required_markers: [/cui/i, /nr. reg. com/i] },
  'BG': { country: 'Bulgaria', law: 'LPPD', regulator: 'CPDP', fine: 'GDPR Standard', required_markers: [/еик/i, /bulstat/i] },
  'HR': { country: 'Croatia', law: 'Zakon o provedbi Opće uredbe', regulator: 'AZOP', fine: 'GDPR Standard', required_markers: [/oib/i] },
  'SI': { country: 'Slovenia', law: 'ZVOP-2', regulator: 'IP', fine: 'GDPR Standard', required_markers: [/matična številka/i, /davčna številka/i] },
  'EE': { country: 'Estonia', law: 'Isikuandmete kaitse seadus', regulator: 'AKI', fine: 'GDPR Standard', required_markers: [/reg. nr/i, /registrikood/i] },
  'LV': { country: 'Latvia', law: 'Fizisko personu datu apstrādes likums', regulator: 'DVI', fine: 'GDPR Standard', required_markers: [/reģ. nr/i] },
  'LT': { country: 'Lithuania', law: 'ADTAĮ', regulator: 'VDAI', fine: 'GDPR Standard', required_markers: [/įmonės kodas/i] },
  'PT': { country: 'Portugal', law: 'Lei 58/2019', regulator: 'CNPD', fine: 'GDPR Standard', required_markers: [/nipc/i] },
  'GR': { country: 'Greece', law: 'Law 4624/2019', regulator: 'HDPA', fine: 'GDPR Standard', required_markers: [/γεμη/i, /αφμ/i] },
  'CY': { country: 'Cyprus', law: 'Law 125(I)/2018', regulator: 'Commissioner', fine: 'GDPR Standard', required_markers: [/vat registration/i] },
  'MT': { country: 'Malta', law: 'Data Protection Act', regulator: 'IDPC', fine: 'GDPR Standard', required_markers: [/company registration/i] },
  'LU': { country: 'Luxembourg', law: 'Loi du 1er août 2018', regulator: 'CNPD', fine: 'GDPR Standard', required_markers: [/rcsl/i, /matricule/i] }
};

export function parseHtmlContent(html: string, url: string): {
  violations: Violation[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> },
  compliance_report: ComplianceReport
} {
  const $ = cheerio.load(html);
  const domain = new URL(url).hostname;
  const tld = domain.split('.').pop()?.toUpperCase() || '';
  const textLower = $('body').text().toLowerCase();

  const violations: Violation[] = [];
  const countryCode = tld === 'COM' || tld === 'NET' ? 'EU' : tld;
  const rule = EU_NATIONAL_RULES[countryCode] || null;

  // 1. Basic GDPR Checks (All EU)
  if (!textLower.includes('privacy policy') && !textLower.includes('datenschutz') && !textLower.includes('politica')) {
    violations.push({
      category: 'Privacy',
      issue_type: 'MISSING_PRIVACY_POLICY',
      severity: 'critical',
      evidence_html: url,
      description: 'No Privacy Policy link identified on the homepage.',
      business_impact: 'Mandatory transparency failure under Art. 13 GDPR.',
      law_name: 'Art. 13 GDPR',
      potential_fine: LIABILITY_GDPR,
      recommendation: 'ACTION: Create a dedicated /privacy page and link it in the footer.',
      explanation: 'Statutory transparency is required before any data processing occurs.',
      confidence_score: 1.0,
      report_type: 'SaaS',
      country: countryCode
    });
  }

  // 2. National Rule Verification
  if (rule) {
    const missingMarkers = rule.required_markers.filter(m => !m.test(textLower));
    if (missingMarkers.length > 0) {
      violations.push({
        category: 'IMPRESSUM',
        issue_type: `INCOMPLETE_NATIONAL_DISCLOSURE_${countryCode}`,
        severity: 'high',
        evidence_html: url,
        description: `Site for ${rule.country} market is missing mandatory identifiers: ${missingMarkers.map(m => m.source).join(', ')}.`,
        business_impact: `Risk of administrative fines from ${rule.regulator}.`,
        law_name: rule.law,
        potential_fine: rule.fine,
        recommendation: `ACTION: Update your legal notice with registered company data (${missingMarkers.map(m => m.source).join('/')}).`,
        explanation: 'European law requires full transparency of commercial operators.',
        confidence_score: 0.9,
        report_type: 'SaaS',
        country: countryCode
      });
    }
  }

  return {
    violations,
    meta: { hasCMP: false, legal_links: {} },
    compliance_report: {
      score: Math.max(0, 100 - (violations.length * 20)),
      grade: violations.length === 0 ? 'A' : 'F',
      verdict: violations.length > 0 ? 'RISKY' : 'COMPLIANT',
      jurisdiction: rule?.country || 'EU General',
      top_risks: violations.map(v => v.issue_type),
      validation_status: 'incomplete',
      nav_scout: { found_links: [], missing_critical: [], discovery_score: 100 },
      lex_analyzer: { has_vat_id: false, has_contact_info: false, has_mandatory_terms: false, content_truncated: false, missing_clusters: [] },
      cmp_detect: { detected_provider: null, is_active: false }
    }
  };
}
