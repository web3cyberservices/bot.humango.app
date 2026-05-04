
import * as cheerio from 'cheerio';

export interface ScanIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export function parseContent(html: string, url: string): ScanIssue[] {
  const $ = cheerio.load(html);
  const issues: ScanIssue[] = [];

  // Check for Robots.txt (Simulated)
  if (html.length < 100) {
    issues.push({
      type: 'ROBOTS_TXT_MISSING',
      severity: 'medium',
      description: `Target ${url} has minimal content, potentially missing robots.txt.`
    });
  }

  // Check for PII fields in forms without HTTPS (Simulated)
  $('form').each((_, el) => {
    const action = $(el).attr('action') || '';
    if (!action.startsWith('https') && url.startsWith('http:')) {
      issues.push({
        type: 'GDPR_PII_LEAK',
        severity: 'critical',
        description: 'Unencrypted form detected on potentially sensitive page.'
      });
    }
  });

  return issues;
}
