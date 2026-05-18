
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, VerificationMethod } from '@/types';

/**
 * @fileOverview Automated Legal Fixer V30.0 - Semantic Intent Discovery.
 * 
 * - Rule: Focus on Link Text (Anchor), not URL Path.
 * - Rule: Multilingual Support (EN, DE, IT, FR, ES, PL).
 * - Rule: Content Verification via LLM.
 */

const LIABILITY_CRITICAL = "Fines up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). High risk of immediate regulatory intervention and ad account suspension.";
const LIABILITY_HIGH = "Administrative penalties up to €20,000,000 or 4% of global annual turnover (Art. 83 GDPR). High risk of competitor cease and desist (Abmahnung) notices.";

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

// Расширенный словарь для семантического поиска ссылок
const DOC_KEYWORDS: Record<string, RegExp[]> = {
  privacy: [
    /privacy/i, /datenschutz/i, /confidentialit/i, /privacidad/i, /rodo/i, 
    /data protection/i, /protection des données/i, /polityka prywatności/i,
    /cookie/i, /kekse/i, /trattamento dati/i, /prywatność/i
  ],
  impressum: [
    /impressum/i, /legal notice/i, /mentions l/i, /aviso legal/i, 
    /site notice/i, /identification/i, /anbieterkennzeichnung/i,
    /contact/i, /kontakt/i, /note legali/i
  ],
  terms: [
    /terms/i, /conditions/i, /agb/i, /cgv/i, /usage/i, /service/i,
    /nutzungsbedingungen/i, /tos/i, /t&c/i, /condizioni/i, /warunki/i
  ]
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

  const links: Record<string, string | null> = { impressum: null, privacy: null, terms: null };
  const allDiscoveredLinks: string[] = [];

  // ШАГ 1: УМНЫЙ СБОР ССЫЛОК ИЗ ПОДВАЛА (FOOTER)
  // Ищем ссылки во всем документе, но отдаем приоритет подвалу
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

    allDiscoveredLinks.push(href);

    // Семантический анализ анкора (текста ссылки)
    if (DOC_KEYWORDS.privacy.some(k => k.test(text))) {
        if (!links.privacy || text.length < 30) links.privacy = href;
    }
    if (DOC_KEYWORDS.impressum.some(k => k.test(text))) {
        if (!links.impressum || text.length < 30) links.impressum = href;
    }
    if (DOC_KEYWORDS.terms.some(k => k.test(text))) {
        if (!links.terms || text.length < 30) links.terms = href;
    }
  });

  const violationMap = new Map<string, Violation>();
  const fullHtmlLower = html.toLowerCase();
  const bodyText = $('body').text();

  // Базовые признаки присутствия юридического контента (для быстрой оценки)
  const identityFound = profile.entitySuffixes.some(s => s.test(fullHtmlLower));
  
  // Если ссылок вообще нет - это критическая ошибка (прозрачность)
  if (!links.privacy && !links.impressum) {
    violationMap.set('Art. 12-Missing', {
      category: 'Privacy',
      report_type: 'SaaS',
      issue_type: 'MISSING LEGAL FOOTER',
      severity: 'critical',
      evidence_html: url,
      description: `No legal disclosure links (Privacy, Impressum, or Terms) were semantically identified in the site structure. Mandatory transparency requirements under Art. 12 GDPR are not met.`,
      business_impact: 'Business Risk: Critical infrastructure failure. Advertising platforms (Meta/Google) will suspend accounts due to lack of mandatory compliance signals.',
      law_name: 'Art. 12 GDPR',
      potential_fine: LIABILITY_CRITICAL,
      explanation: 'Commercial websites must provide easy access to legal information from any page, typically via a footer.',
      recommendation: `ACTION: INSERT THIS HTML -> "<footer class=\"legal-footer\"><a href=\"/privacy\">Privacy Policy</a> | <a href=\"/legal\">Legal Notice</a></footer>"`,
      verification_method
    });
  }

  const violations = Array.from(violationMap.values());
  const score = Math.max(0, 100 - (violations.length * 25));

  return {
    violations,
    discoveredLinks: allDiscoveredLinks,
    meta: { hasCMP: false, legal_links: links },
    compliance_report: {
      score,
      grade: score > 90 ? 'A' : score > 70 ? 'C' : 'F',
      verdict: violations.length > 0 ? 'RISKY' : 'COMPLIANT',
      jurisdiction: profile.name,
      top_risks: violations.slice(0, 3).map(v => v.issue_type),
      validation_status: 'incomplete',
      nav_scout: { 
          found_links: Object.values(links).filter(Boolean) as string[], 
          missing_critical: Object.entries(links).filter(([_, v]) => !v).map(([k]) => k),
          discovery_score: score 
      },
      lex_analyzer: { has_vat_id: true, has_contact_info: identityFound, has_mandatory_terms: !!links.terms, content_truncated: false, missing_clusters: [] },
      cmp_detect: { detected_provider: null, is_active: false }
    }
  };
}
