
import * as cheerio from 'cheerio';
import { Violation, Category, Severity } from '@/types';

/**
 * Heuristic check: determine if Deep Scan (browser) is required.
 */
export function shouldRunDeepScan(html: string): boolean {
  const indicators = [
    'react.js', 'vue.js', '_next/static', 'gtm.js', 'fbevents.js', 
    'adsbygoogle', 'intercom', 'cookie-law', 'cookie-banner', 
    'cookie-consent', 'trustarc', 'onetrust', 'didomi'
  ];
  const lowerHtml = html.toLowerCase();
  return indicators.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
}

/**
 * Main HTML parser for technical and compliance audit.
 */
export function parseHtmlContent(html: string, url: string, headers: any = {}): { violations: Violation[], discoveredLinks: string[] } {
  const $ = cheerio.load(html);
  const violations: Violation[] = [];
  const discoveredLinks: string[] = [];

  // Discovery logic
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const absoluteUrl = new URL(href, url).href;
        // Only crawl http/https and stay away from non-web protocols
        if (absoluteUrl.startsWith('http')) {
           discoveredLinks.push(absoluteUrl);
        }
      } catch (e) {}
    }
  });

  // --- ADA Compliance Audit ---
  
  // 1. Missing ALT text on images
  $('img:not([alt])').each((_, el) => {
    violations.push({
      category: 'ADA',
      issue_type: 'MISSING_ALT_TEXT',
      severity: 'medium',
      evidence_html: $.html(el),
      description: 'Image element found without an alt attribute. This prevents screen readers from describing the image.'
    });
  });

  // 2. Empty interactive elements
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    if (!text && !ariaLabel) {
      violations.push({
        category: 'ADA',
        issue_type: 'EMPTY_INTERACTIVE_ELEMENT',
        severity: 'high',
        evidence_html: $.html(el),
        description: 'Interactive element (link or button) has no descriptive text or aria-label.'
      });
    }
  });

  // 3. Language attribute missing
  if (!$('html').attr('lang')) {
    violations.push({
      category: 'ADA',
      issue_type: 'MISSING_HTML_LANG',
      severity: 'low',
      evidence_html: '<html>',
      description: 'The root HTML element is missing a lang attribute, which is required for speech synthesis and accessibility.'
    });
  }

  // --- GDPR & Privacy Audit ---

  // 4. External Google Fonts (IP Leakage risk)
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    violations.push({
      category: 'GDPR',
      issue_type: 'EXTERNAL_GOOGLE_FONTS',
      severity: 'medium',
      evidence_html: $.html(el),
      description: 'Loading Google Fonts from external servers transmits user IP addresses to Google without explicit consent.'
    });
  });

  // 5. Unsecure form submissions
  $('form').each((_, el) => {
    const action = $(el).attr('action') || '';
    const isUnsecure = action.startsWith('http://') || (!action.startsWith('https://') && url.startsWith('http://'));
    if (isUnsecure) {
      violations.push({
        category: 'GDPR',
        issue_type: 'UNSECURE_FORM_SUBMISSION',
        severity: 'critical',
        evidence_html: $.html(el),
        description: 'Form submits data over an unencrypted HTTP connection. This is a severe GDPR violation.'
      });
    }
  });

  // 6. Privacy Policy detection
  const hasPrivacyLink = $('a').toArray().some(a => {
    const text = $(a).text().toLowerCase();
    const href = $(a).attr('href')?.toLowerCase() || '';
    return text.includes('privacy') || text.includes('policy') || href.includes('privacy');
  });

  if (!hasPrivacyLink) {
    violations.push({
      category: 'Privacy',
      issue_type: 'MISSING_PRIVACY_POLICY',
      severity: 'high',
      evidence_html: '<footer>',
      description: 'No link to a Privacy Policy page was detected in the visible content.'
    });
  }

  // --- Security Audit ---

  // 7. Missing CSP
  const hasCSP = $('meta[http-equiv="Content-Security-Policy"]').length > 0 || headers['content-security-policy'];
  if (!hasCSP) {
    violations.push({
      category: 'Security',
      issue_type: 'MISSING_CSP',
      severity: 'medium',
      evidence_html: '<head>',
      description: 'Content Security Policy (CSP) is missing. This increases the risk of XSS and data injection attacks.'
    });
  }

  return { 
    violations, 
    discoveredLinks: Array.from(new Set(discoveredLinks)).slice(0, 10) 
  };
}
