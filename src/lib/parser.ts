
import * as cheerio from 'cheerio';
import { Violation, ComplianceReport, Category } from '@/types';

const LEGAL_PATTERNS = {
  impressum: [/impressum/i, /legal notice/i, /mentions l[eé]gales/i, /aviso legal/i, /note legali/i, /legal disclosure/i],
  privacy: [/privacy/i, /datenschutz/i, /confidentialit[eé]/i, /privacidad/i, /data protection/i, /privacy-policy/i],
  terms: [/terms/i, /tos/i, /conditions/i, /bedingungen/i, /condiciones/i, /agb/i, /terms-of-service/i],
  cookies: [/cookie/i, /galletas/i, /biscotti/i, /cookie policy/i, /cookie-richtlinie/i]
};

const MANDATORY_CLUSTERS = {
  CONTROLLER: {
    keywords: [/data controller/i, /verantwortlicher/i, /responsable du traitement/i, /titular del tratamiento/i, /identity of the controller/i],
    law: "GDPR Article 13(1)(a)",
    desc: "Identity and contact details of the controller.",
    remediation: "Include the full legal name of your entity, registered physical address, and a direct contact email in the first section of your policy."
  },
  RIGHTS: {
    keywords: [/right to access/i, /right to erasure/i, /right to object/i, /auskunftsrecht/i, /l[öo]schungsrecht/i, /widerrufsrecht/i, /data subject rights/i],
    law: "GDPR Article 13(2)(b)",
    desc: "Information on data subject rights (access, rectification, erasure).",
    remediation: "Add a dedicated section explaining that users have the right to request access, correction, or deletion of their personal data."
  },
  RETENTION: {
    keywords: [/retention period/i, /speicherdauer/i, /dur[eé]e de conservation/i, /plazo de conservaci[oó]n/i, /storage period/i],
    law: "GDPR Article 13(2)(a)",
    desc: "The period for which the personal data will be stored.",
    remediation: "Specify clear criteria or exact timeframes for how long user data is stored (e.g., 'Marketing data is kept for 24 months')."
  },
  DPO: {
    keywords: [/data protection officer/i, /datenschutzbeauftragter/i, /délégué à la protection des données/i, /DPO contact/i],
    law: "GDPR Article 13(1)(b)",
    desc: "Contact details of the Data Protection Officer (if applicable).",
    remediation: "If your organization is required to appoint a DPO, provide their professional contact details for privacy inquiries."
  }
};

const FINE_LOOKUP: Record<string, string> = {
  Legal_Content: "€10,000 - €20,000,000 or 4% of annual global turnover (GDPR Art. 83).",
  Security: "€5,000 - €10,000,000 or 2% of annual global turnover (GDPR Art. 83).",
  Privacy: "€10,000 - €20,000,000 or 4% of annual global turnover (GDPR Art. 83)."
};

function normalizeUrl(url: string, base: string): string | null {
  try {
    const absolute = new URL(url, base);
    absolute.hash = '';
    absolute.search = ''; 
    let pathname = absolute.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    absolute.pathname = pathname;
    return absolute.href;
  } catch (e) {
    return null;
  }
}

function navScout($: cheerio.CheerioAPI, baseUrl: string) {
  const links: Record<string, string | null> = { impressum: null, privacy: null, terms: null, cookies: null };
  const missing_critical: string[] = [];
  let score = 0;

  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href')?.toLowerCase() || '';
    if (!href || href.startsWith('javascript:')) return;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;

    if (!links.impressum && LEGAL_PATTERNS.impressum.some(p => p.test(text) || p.test(href))) {
      links.impressum = normalized; score += 40;
    }
    if (!links.privacy && LEGAL_PATTERNS.privacy.some(p => p.test(text) || p.test(href))) {
      links.privacy = normalized; score += 30;
    }
    if (!links.terms && LEGAL_PATTERNS.terms.some(p => p.test(text) || p.test(href))) {
      links.terms = normalized; score += 15;
    }
    if (!links.cookies && LEGAL_PATTERNS.cookies.some(p => p.test(text) || p.test(href))) {
      links.cookies = normalized; score += 15;
    }
  });

  if (!links.impressum) missing_critical.push('Impressum / Legal Notice');
  if (!links.privacy) missing_critical.push('Privacy Policy');

  return { links, missing_critical, discovery_score: Math.min(score, 100) };
}

function lexAnalyzer(html: string) {
  const text = html.substring(0, 102400).toLowerCase();
  const missing_clusters: string[] = [];
  
  Object.entries(MANDATORY_CLUSTERS).forEach(([key, cluster]) => {
    if (!cluster.keywords.some(k => k.test(text))) {
      missing_clusters.push(key);
    }
  });

  const has_vat_id = /de[0-9]{9}/i.test(text);
  const has_email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const has_phone = /\+?[0-9\s-]{8,20}/i.test(text);

  let score = 100 - (missing_clusters.length * 20);
  if (!has_email && !has_phone) score -= 20;

  return {
    score: Math.max(score, 0),
    has_vat_id,
    has_contact_info: has_email && has_phone,
    missing_clusters,
    content_truncated: html.length > 102400
  };
}

export function parseHtmlContent(html: string, url: string, headers: any = {}, screenshot?: string, isPuppeteer: boolean = false): { 
  violations: Violation[], 
  discoveredLinks: string[],
  meta: { hasCMP: boolean, legal_links: Record<string, string | null> },
  compliance_report: ComplianceReport
} {
  const $ = cheerio.load(html);
  const verification_method = isPuppeteer ? 'Dynamic Emulation' : 'Static Analysis';
  
  const nav = navScout($, url);
  const lex = lexAnalyzer(html);
  const violations: Violation[] = [];

  // 1. Missing Documents (NAV-SCOUT)
  nav.missing_critical.forEach(missing => {
    const isImpressum = missing.includes('Impressum');
    violations.push({
      category: (isImpressum ? 'Legal_Content' : 'Privacy') as Category,
      report_type: 'SaaS',
      issue_type: `Missing ${missing}`,
      severity: 'critical',
      evidence_html: url,
      description: `NAV-SCOUT engine scanned the navigation and footer but failed to detect a dedicated link to ${missing}.`,
      law_name: isImpressum ? '§ 5 TMG / Art. 13 GDPR' : 'Art. 13 GDPR',
      potential_fine: FINE_LOOKUP[isImpressum ? 'Legal_Content' : 'Privacy'],
      explanation: 'Mandatory legal information must be easily recognizable, directly accessible, and permanently available.',
      recommendation: `Implement a footer link explicitly labeled "${missing}" pointing to a compliant document.`,
      verification_method
    });
  });

  // 2. Incomplete Documents (LEX-ANALYZER)
  // We only run this if the link WAS found, otherwise it's just 'Missing'
  if (nav.links.privacy || nav.links.impressum) {
    lex.missing_clusters.forEach(clusterKey => {
      const cluster = MANDATORY_CLUSTERS[clusterKey as keyof typeof MANDATORY_CLUSTERS];
      const targetDoc = clusterKey === 'CONTROLLER' && nav.links.impressum ? 'Legal Notice' : 'Privacy Policy';
      const targetUrl = (clusterKey === 'CONTROLLER' ? nav.links.impressum : nav.links.privacy) || url;

      violations.push({
        category: 'Privacy',
        report_type: 'SaaS',
        issue_type: `Incomplete Document: Missing ${clusterKey}`,
        severity: 'high',
        evidence_html: targetUrl,
        snippet: html.substring(0, 500) + '...', 
        description: `LEX-ANALYZER identified the ${targetDoc} but detected a critical omission of the ${cluster.desc}`,
        law_name: cluster.law,
        potential_fine: FINE_LOOKUP.Privacy,
        explanation: `Transparency according to Art. 13 GDPR requires specific disclosures. Your document is missing the ${clusterKey} section.`,
        recommendation: cluster.remediation,
        verification_method
      });
    });
  }

  const score = Math.round((nav.discovery_score + lex.score) / 2);
  const verdict = (nav.missing_critical.length === 0 && lex.missing_clusters.length === 0) ? 'COMPLIANT' : 'RISKY';

  return { 
    violations, 
    discoveredLinks: [], 
    meta: { hasCMP: false, legal_links: nav.links },
    compliance_report: {
      score,
      verdict,
      nav_scout: {
        found_links: Object.values(nav.links).filter(Boolean) as string[],
        missing_critical: nav.missing_critical,
        discovery_score: nav.discovery_score
      },
      lex_analyzer: {
        has_vat_id: lex.has_vat_id,
        has_contact_info: lex.has_contact_info,
        has_mandatory_terms: true,
        content_truncated: lex.content_truncated,
        missing_clusters: lex.missing_clusters
      },
      cmp_detect: {
        detected_provider: null,
        is_active: false
      }
    }
  };
}
