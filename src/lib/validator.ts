
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Violation } from '@/types';

/**
 * @fileOverview Legal Integrity Validator Service.
 * Verifies crawler findings against actual HTML evidence using LLM.
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
    missing_facts: z.array(z.string()).optional(),
  })),
  integrity_status: z.enum(['verified', 'incomplete', 'suspicious']),
});

export async function verifyIntegrity(html: string, findings: Violation[]) {
  return verifyIntegrityFlow({ html: html.substring(0, 50000), findings });
}

const verifyIntegrityFlow = ai.defineFlow(
  {
    name: 'verifyIntegrityFlow',
    inputSchema: ValidationInputSchema,
    outputSchema: ValidationOutputSchema,
  },
  async (input) => {
    const prompt = ai.definePrompt({
      name: 'verifyIntegrityPrompt',
      input: { schema: ValidationInputSchema },
      output: { schema: ValidationOutputSchema },
      prompt: `You are a Senior Legal Data Auditor. Your task is to verify if the following compliance findings are supported by the provided HTML content.

CRITICAL RULES:
1. CROSS-CHECK: If a finding claims "Controller Identity Found", you MUST find the exact entity name and address in the HTML.
2. EVIDENCE REJECTION: If a finding claims a breach but you see evidence of compliance (e.g. a link to a Privacy Policy is actually present), mark as is_hallucination: true.
3. QUOTES: For every confirmed finding, provide the exact string of text from the HTML that serves as evidence.
4. CONFIDENCE: 
   - 1.0: Exact match found with clear context.
   - 0.5: Partial match (e.g. "Berlin" found but no street address for an entity).
   - 0.0: No evidence or contradictory evidence found.

Findings to verify:
{{#each findings}}
- Type: {{{issue_type}}}
  Description: {{{description}}}
{{/each}}

HTML Content Snippet:
{{{html}}}`,
    });

    const { output } = await prompt(input);
    return output!;
  }
);
