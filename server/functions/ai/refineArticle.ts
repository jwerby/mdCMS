import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generateWithAnthropic } from './anthropic'
import type { EvaluationResult } from './evaluateArticle'
import { parseFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'

/**
 * Refinement Result
 */
export interface RefinementResult {
  content: string
  changesApplied: string[]
  provider: string
  refinedAt: string
}

/**
 * Build targeted refinement prompt based on evaluation issues
 *
 * Key insight: We don't rewrite the whole article.
 * We pass SPECIFIC issues and ask Claude to fix ONLY those.
 */
export function buildRefinementPrompt(
  draft: string,
  evaluation: Partial<EvaluationResult>
): string {
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(draft)
  const h1Match = body.match(/^#\s+(.+)$/m)
  const topic = typeof frontmatter.meta_title === 'string'
    ? frontmatter.meta_title
    : (h1Match?.[1] ?? 'Article refinement')
  const primaryKeyword = typeof frontmatter.primary_keyword === 'string'
    ? frontmatter.primary_keyword
    : topic
  const secondaryKeywords = typeof frontmatter.secondary_keywords === 'string'
    ? frontmatter.secondary_keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []
  const guidance = buildGuidanceBlock(buildContentProfile({
    topic,
    primaryKeyword,
    secondaryKeywords,
    draft: body,
  }))

  const issues: string[] = []

  // Collect all issues from evaluation
  if (evaluation.hallucinations?.length) {
    issues.push(`ACCURACY ERRORS (MUST FIX):\n${evaluation.hallucinations.map(h => `- ${h}`).join('\n')}`)
  }

  if (evaluation.clichesFound?.length) {
    issues.push(`AI CLICHES TO REMOVE:\n${evaluation.clichesFound.map(c => `- Replace or remove: "${c}"`).join('\n')}`)
  }

  if (evaluation.localIssues?.length) {
    issues.push(`LOCAL ACCURACY FIXES:\n${evaluation.localIssues.map(i => `- ${i}`).join('\n')}`)
  }

  if (evaluation.grammarFixes?.length) {
    issues.push(`GRAMMAR FIXES:\n${evaluation.grammarFixes.map(g => `- ${g}`).join('\n')}`)
  }

  if (evaluation.readabilityIssues?.length) {
    issues.push(`READABILITY ISSUES:\n${evaluation.readabilityIssues.map(r => `- ${r}`).join('\n')}`)
  }

  if (evaluation.seoMissing?.length) {
    issues.push(`SEO FIXES NEEDED:\n${evaluation.seoMissing.map(s => `- ${s}`).join('\n')}`)
  }

  return `You are an expert editor. Your job is to FIX SPECIFIC ISSUES in an article.

CRITICAL RULES:
1. DO NOT rewrite sections that are already good
2. ONLY fix the specific issues listed below
3. Maintain the original voice and style
4. Keep the same overall structure
5. Output the COMPLETE fixed article

---

${guidance}

ISSUES TO FIX:

${issues.join('\n\n')}

---

SPECIFIC REPLACEMENTS:
- Replace generic "business license" → "BPOL (Business, Professional, and Occupational License)"
- Replace "Moreover," "Furthermore," "In conclusion" → more natural transitions or remove entirely
- Replace "It is important to note" → just state the fact directly
- Replace "Delve into" or "Dive into" → "explore" or "examine" or remove

---

ORIGINAL ARTICLE:

${draft}

---

OUTPUT: The complete fixed article with ONLY the issues above addressed.
Start with the frontmatter (---) and include the full content.
Do NOT add explanations or commentary about your changes.`
}

/**
 * Refine an article based on evaluation feedback
 *
 * Uses Claude Sonnet for refinement to maintain the same voice
 * as the original draft (which was also written by Claude)
 */
export const refineArticle = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    draft: z.string().min(100),
    evaluation: z.object({
      hallucinations: z.array(z.string()).optional(),
      clichesFound: z.array(z.string()).optional(),
      localIssues: z.array(z.string()).optional(),
      grammarFixes: z.array(z.string()).optional(),
      readabilityIssues: z.array(z.string()).optional(),
      seoMissing: z.array(z.string()).optional(),
    }),
  }))
  .handler(async ({ data }): Promise<RefinementResult> => {
    const prompt = buildRefinementPrompt(data.draft, data.evaluation)

    const response = await generateWithAnthropic({
      prompt,
      systemPrompt: 'You are an expert editor. Fix only the specific issues listed. Maintain the original voice.',
      maxTokens: 8192,
      temperature: 0.3, // Low temperature for consistent edits
    })

    // Track what changes were requested
    const changesApplied: string[] = []

    if (data.evaluation.hallucinations?.length) {
      changesApplied.push(`Fixed ${data.evaluation.hallucinations.length} accuracy issues`)
    }
    if (data.evaluation.clichesFound?.length) {
      changesApplied.push(`Removed ${data.evaluation.clichesFound.length} AI cliches`)
    }
    if (data.evaluation.localIssues?.length) {
      changesApplied.push(`Fixed ${data.evaluation.localIssues.length} local accuracy issues`)
    }
    if (data.evaluation.grammarFixes?.length) {
      changesApplied.push(`Applied ${data.evaluation.grammarFixes.length} grammar fixes`)
    }
    if (data.evaluation.seoMissing?.length) {
      changesApplied.push(`Addressed ${data.evaluation.seoMissing.length} SEO issues`)
    }

    return {
      content: response,
      changesApplied,
      provider: 'anthropic',
      refinedAt: new Date().toISOString(),
    }
  })

/**
 * Quick refinement for common issues without full evaluation
 * Useful for post-publish touch-ups
 */
export const quickRefine = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    draft: z.string().min(100),
    fixes: z.array(z.enum([
      'remove_cliches',
      'fix_bpol',
      'shorten_paragraphs',
      'add_keyword_to_intro',
    ])),
    primaryKeyword: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<RefinementResult> => {
    const fixInstructions: string[] = []

    if (data.fixes.includes('remove_cliches')) {
      fixInstructions.push(`Remove or replace these phrases if present: "Moreover", "Furthermore", "In conclusion", "It is important to note", "Delve into", "Dive into", "Game-changing", "Unleash"`)
    }

    if (data.fixes.includes('fix_bpol')) {
      fixInstructions.push(`Replace generic "business license" with "BPOL (Business, Professional, and Occupational License)" for Virginia Beach context`)
    }

    if (data.fixes.includes('shorten_paragraphs')) {
      fixInstructions.push(`Break any paragraph longer than 4 sentences into shorter paragraphs`)
    }

    if (data.fixes.includes('add_keyword_to_intro') && data.primaryKeyword) {
      fixInstructions.push(`Ensure "${data.primaryKeyword}" appears naturally in the first 100 words`)
    }

    const prompt = `You are an expert editor. Apply ONLY these specific fixes to the article:

${fixInstructions.map((f, i) => `${i + 1}. ${f}`).join('\n')}

ARTICLE:
${data.draft}

OUTPUT: The complete fixed article. Do NOT add explanations.`

    const response = await generateWithAnthropic({
      prompt,
      systemPrompt: 'You are an expert editor. Apply only the specified fixes. Maintain the original voice.',
      maxTokens: 8192,
      temperature: 0.2,
    })

    return {
      content: response,
      changesApplied: data.fixes.map(f => f.replace(/_/g, ' ')),
      provider: 'anthropic',
      refinedAt: new Date().toISOString(),
    }
  })
