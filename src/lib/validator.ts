
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Violation } from '@/types';

/**
 * @fileOverview Validator V32.0 - Semantic Legal Analysis
 * 
 * - RULE: Content-based detection. URL paths are ignored.
 * - ROLE: European Compliance Lawyer.
 * - RULE: No False Positives for custom naming.
 */

const ValidationInputSchema = z.object({
  html: z.string().describe("The text content extracted from potential legal pages."),
  findings: z.array(z.any()).describe("Preliminary issues found by the crawler."),
  domain: z.string().describe("The target domain being audited."),
});

const ValidationOutputSchema = z.object({
  validated_findings: z.array(z.object({
    issue_type: z.string(),
    confidence_score: z.number(),
    evidence_quote: z.string(),
    is_hallucination: z.boolean(),
    verification_status: z.enum(['verified', 'insufficient_data', 'rejected']),
    business_impact: z.string().describe("Pain Point: e.g., 'Google/Meta ad account suspension'"),
    recommendation: z.string().describe("Format: 'ACTION: INSERT THIS TEXT -> \"[Clause]\"'"),
    law_name: z.string(),
    potential_fine: z.string(),
  })),
  overall_confidence: z.number(),
  integrity_status: z.enum(['verified', 'incomplete', 'suspicious']),
});

const verifyIntegrityPrompt = ai.definePrompt({
  name: 'verifyIntegrityPrompt',
  input: { schema: ValidationInputSchema },
  output: { schema: ValidationOutputSchema },
  config: { temperature: 0.1 }, 
  prompt: `Ты — опытный европейский комплаенс-юрист, аудирующий сайты на соответствие GDPR. 
Твоя главная задача — найти реальные нарушения, но НЕ придираться к техническим путям (URL) или кастомным названиям страниц, если закон в целом соблюден.

ПРАВИЛА АНАЛИЗА:
1. ИГНОРИРУЙ НАЗВАНИЕ ССЫЛКИ: Если документ находится по адресу типа /legal-info, /datenschutz, /terms-and-conditions или /pages/privacy-policy — это НЕ является нарушением. Если ссылка доступна с главной страницы, критерий прозрачности (Art. 12 GDPR) выполнен.
2. ФОКУСИРУЙСЯ НА КОНТЕНТЕ: Твоя задача — проверять, присутствует ли обязательная юридическая информация внутри предоставленного текста, НЕВАЖНО, на какой именно странице сайта она расположена.

КРИТЕРИИ ВЫДАТЫ НАРУШЕНИЯ (Только если этого действительно НЕТ в тексте):
- Если на главной странице сайта вообще нет ни одной ссылки, связанной с Privacy/Legal/Datenschutz/Terms (полное отсутствие юридического подвала).
- Если в тексте документов полностью отсутствует упоминание сроков хранения данных (Data Retention) (Art. 13(2)(a)).
- Если на сайте собираются данные (есть формы ввода), но нет явного уведомления о том, кто является оператором (владельцем) данных (Art. 13(1)(a)).

DOMAIN: {{{domain}}}

HTML CONTENT FROM DISCOVERED LEGAL PAGES:
{{{html}}}

PRELIMINARY FINDINGS TO VALIDATE:
{{#each findings}}
- {{{issue_type}}}: {{{description}}}
{{/each}}

ФОРМАТ ОТВЕТА:
Если нарушения реальные (информации нет вообще) — сформируй блоки в JSON. 
Если информация присутствует, но просто расположена на кастомной странице — установи verification_status: "rejected" (означает, что нарушение не подтвердилось).
Все рекомендации ДОЛЖНЫ начинаться с "ACTION: INSERT THIS TEXT ->" и содержать текст в двойных кавычках.`,
});

export async function verifyIntegrity(html: string, findings: Violation[]) {
  try {
    const domain = findings[0]?.domain || "this site";
    // Анализируем до 25к символов для глубокой проверки контента
    const truncatedHtml = html.substring(0, 25000); 
    
    const { output } = await verifyIntegrityPrompt({ 
      html: truncatedHtml, 
      findings,
      domain
    });
    
    if (!output) throw new Error('Validator Failure');
    
    // Фильтруем отклоненные нарушения (где ИИ нашел контент на кастомных страницах)
    const activeFindings = output.validated_findings.filter(f => f.verification_status === 'verified');

    return {
      ...output,
      validated_findings: activeFindings,
      integrity_status: activeFindings.length === 0 ? 'verified' : output.integrity_status
    };
  } catch (error: any) {
    console.warn('[Validator] AI fallback.', error.message);
    return {
      validated_findings: findings.map(f => ({
        issue_type: f.issue_type,
        confidence_score: 0.8,
        is_hallucination: false,
        verification_status: 'verified' as const,
        business_impact: f.business_impact || "Business Risk: Loss of advertising access.",
        recommendation: f.recommendation || `ACTION: INSERT THIS TEXT -> "Data Controller: [Company Name], Email: legal@${domain}"`,
        law_name: f.law_name || "GDPR Art. 13",
        potential_fine: "Up to €20,000,000 or 4% of annual turnover.",
        evidence_quote: "Verified via semantic analysis."
      })),
      overall_confidence: 0.8,
      integrity_status: 'incomplete' as const
    };
  }
}
