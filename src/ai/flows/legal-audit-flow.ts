
'use server';
/**
 * @fileOverview AI Legal Audit Analyzer
 * Generates structured JSON for PDF reports based on raw scan logs.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AuditInputSchema = z.object({
  domain: z.string().describe("The domain being audited."),
  violations: z.array(z.object({
    issue_type: z.string(),
    description: z.string(),
    law_name: z.string()
  })).describe("Raw violations found on the site.")
});

const AuditOutputSchema = z.object({
  report: z.array(z.object({
    title: z.string().describe("e.g., CRITICAL INCOMPLETENESS"),
    law: z.string().describe("e.g., GDPR Article 13"),
    summary: z.string().describe("Detailed factual description of the violation."),
    impact: z.string().describe("Business impact, e.g., ad account suspension."),
    liability: z.string().describe("Financial fine details."),
    action: z.string().describe("Copy-paste ready HTML/Text fix starting with 'ACTION: INSERT THIS TEXT ->'")
  }))
});

export type AuditOutput = z.infer<typeof AuditOutputSchema>;

export const legalAuditPrompt = ai.definePrompt({
  name: 'legalAuditPrompt',
  input: { schema: AuditInputSchema },
  output: { schema: AuditOutputSchema },
  prompt: `You are the lead Legal AI Analyst at Humango. Your task is to generate data for a Statutory Compliance Audit report.

Domain: {{{domain}}}

Preliminary Violations:
{{#each violations}}
- Type: {{{issue_type}}}
- Description: {{{description}}}
- Law: {{{law_name}}}
{{/each}}

For each violation, generate a high-impact, professional legal analysis. Use dry, authoritative language. 
Fines must be listed as "Up to €20,000,000 or 4% of global annual turnover under Art. 83 GDPR".
Remediation actions must provide exact text to insert into the site.`,
});

export async function generateLegalAudit(input: z.infer<typeof AuditInputSchema>): Promise<AuditOutput> {
  const { output } = await legalAuditPrompt(input);
  return output!;
}
