
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Violation } from '@/types';

/**
 * @fileOverview Legal Data Truth Verifier.
 * Critical auditor that examines crawler findings for hallucinations and missing facts.
 */

const ValidationInputSchema = z.object({
  html: z.string().describe("The raw HTML content of the page."),
  findings: z.array(z.any()).describe("The list of potential violations identified by the crawler."),
});

const ValidationOutputSchema = z.object({
  validated_findings: z.array(z.object({
    issue_type: z.string(),
    confidence_score: z.number().min(0).max(1),
    evidence_quote: z.string().optional(),
    is_hallucination: z.boolean(),
    verification_status: z.enum(['verified', 'insufficient_data', 'rejected']),
    business_impact: z.string().optional().describe("A simple, non-legal explanation of the business risk (e.g., loss of sales, risk of ad account blocking)."),
    missing_facts: z.array(z.string()).optional().describe("Specific missing facts for the crawler to find in a second pass."),
  })),
  overall_confidence: z.number().min(0).max(1),
  integrity_status: z.enum(['verified', 'incomplete', 'suspicious']),
});

const verifyIntegrityPrompt = ai.definePrompt({
  name: 'verifyIntegrityPrompt',
  input: { schema: ValidationInputSchema },
  output: { schema: ValidationOutputSchema },
  prompt: `You are a Senior Legal Data Auditor and Truth Verifier. 
Your role is to act as a harsh critic and examine crawler findings against raw HTML.

TASK:
1. EXAMINE facts (Address, Company Name, VAT ID, etc.) in the provided findings.
2. VERIFY against HTML: 
   - Is it a real fact or a hallucination? (e.g. "Berlin" is NOT an address. "Friedrichstraße 12, 10117 Berlin" IS an address).
   - Is the source URL relevant?
3. ASSIGN CONFIDENCE:
   - 1.0: Exact, detailed match found with clear context.
   - 0.5: Weak/partial match. 
   - 0.0: No evidence or contradictory evidence found.
4. GENERATE USER-FRIENDLY BUSINESS IMPACT:
   - For every finding, provide a simple explanation of why this matters to the business owner.
   - Use non-legal terms like "Loss of trust", "Risk of ad account blocking", "Vulnerability to customer complaints".
   - Examples: 
     - Identity missing? "Loss of trust: Visitors are afraid to leave data, as they don't know who the owner is. This reduces sales."
     - No Cookie Policy? "Risk of blocking: Advertising platforms (Google/Meta) may block your account for non-compliance."
     - Art. 13 issues? "Vulnerability to complaints: Any dissatisfied client can file a complaint, which will lead to a regulatory audit."

IMPORTANT:
- DO NOT invent information.
- Provide a clear EVIDENCE QUOTE for every verified finding.
- If information is missing or weak, list the specific MISSING FACTS for the second crawl pass.

Findings to verify:
{{#each findings}}
- Article/Type: {{{issue_type}}}
  Diagnostic Summary: {{{description}}}
{{/each}}

HTML Content Snippet:
{{{html}}}`,
});

const verifyIntegrityFlow = ai.defineFlow(
  {
    name: 'verifyIntegrityFlow',
    inputSchema: ValidationInputSchema,
    outputSchema: ValidationOutputSchema,
  },
  async (input) => {
    const { output } = await verifyIntegrityPrompt(input);
    if (!output) throw new Error('Validator returned no output');
    return output;
  }
);

export async function verifyIntegrity(html: string, findings: Violation[]) {
  return verifyIntegrityFlow({ html: html.substring(0, 50000), findings });
}
