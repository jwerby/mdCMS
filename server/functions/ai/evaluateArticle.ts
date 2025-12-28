import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generateWithGemini } from './gemini'
import { EVALUATION_THRESHOLDS, evaluationPasses } from './model-config'

/**
 * Evaluation Result Schema
 * The Judge Swarm returns structured feedback across 6 dimensions
 */
export interface EvaluationResult {
  // Scores (1-10)
  readabilityScore: number
  accuracyScore: number
  grammarScore: number
  uniquenessScore: number
  optimizationScore: number
  localAccuracyScore: number

  // Specific issues found
  readabilityIssues: string[]
  hallucinations: string[]
  grammarFixes: string[]
  clichesFound: string[]
  seoMissing: string[]
  localIssues: string[]

  // Overall verdict
  overallScore: number
  passFail: 'PASS' | 'FAIL'
  failReasons: string[]

  // Metadata
  evaluatedAt: string
  provider: string
}

/**
 * Banned phrases that indicate "AI smell"
 */
const AI_CLICHES = [
  'Moreover',
  'Furthermore',
  'In conclusion',
  'It is important to note',
  'It is worth noting',
  'Delve into',
  'Delve deeper',
  'Game-changing',
  'Groundbreaking',
  'Unleash',
  'Unlock the power',
  'Digital landscape',
  'In today\'s fast-paced',
  'In today\'s world',
  'Navigate the complexities',
  'Embark on',
  'Embark on a journey',
  'Dive into',
  'Dive deep',
  'Leverage',
  'Harness the power',
  'Seamlessly',
  'Robust',
  'Cutting-edge',
  'State-of-the-art',
  'Take it to the next level',
  'At the end of the day',
]

/**
 * Virginia Beach specific terms that should be accurate
 */
const VB_ACCURACY_TERMS = [
  { term: 'business license', preferred: 'BPOL (Business, Professional, and Occupational License)' },
  { term: 'ViBe', context: 'ViBe Creative District' },
  { term: 'Hampton Roads Chamber', url: 'https://www.hamptonroadschamber.com/' },
  { term: 'SCC', fullName: 'Virginia State Corporation Commission' },
]

/**
 * Build the Judge Swarm evaluation prompt
 */
function buildEvaluationPrompt(
  draft: string,
  sourceMaterials: string,
  primaryKeyword: string
): string {
  return `You are an expert Editor-in-Chief running a "Judge Swarm" evaluation.

TASK: Analyze the [GENERATED_DRAFT] against the [SOURCE_MATERIALS] and score it on 6 dimensions.

[SOURCE_MATERIALS]
${sourceMaterials || 'No source materials provided - evaluate based on general accuracy only.'}

[GENERATED_DRAFT]
${draft}

[PRIMARY_KEYWORD]
${primaryKeyword}

[BANNED_CLICHES]
${AI_CLICHES.join(', ')}

[VIRGINIA_BEACH_ACCURACY_RULES]
- Use "BPOL (Business, Professional, and Occupational License)" instead of generic "business license"
- ViBe Creative District is the correct name
- Hampton Roads Chamber of Commerce website: https://www.hamptonroadschamber.com/
- Virginia State Corporation Commission (SCC) for business registration

---

EVALUATE ON THESE 6 DIMENSIONS:

1. READABILITY Judge:
   - Score 1-10 on scannability and flow
   - Flag paragraphs longer than 4 sentences
   - Flag sentences with more than 30 words
   - Check for logical section progression

2. ACCURACY Judge (CRITICAL):
   - Score 1-10 on factual accuracy
   - Compare EVERY claim against [SOURCE_MATERIALS]
   - Flag any stats, dates, quotes, or URLs not in source (hallucinations)
   - Flag any claims that contradict the source
   - If no source materials, flag unverifiable specific claims

3. GRAMMAR & SYNTAX Judge:
   - Score 1-10 on technical correctness
   - Flag objective grammatical errors
   - Flag excessive passive voice (>15% of sentences)
   - Flag repetitive sentence structures

4. UNIQUENESS / "AI SMELL" Judge:
   - Score 1-10 on human authenticity
   - Flag any phrases from [BANNED_CLICHES] list
   - Flag generic transitions and filler
   - Does it sound like an expert or a generic AI summary?

5. OPTIMIZATION (SEO) Judge:
   - Score 1-10 on SEO structure
   - Is primary keyword "${primaryKeyword}" in H1?
   - Is keyword in first 100 words?
   - Is keyword in at least one H2?
   - Are headers logically nested (H1 -> H2 -> H3)?
   - Are there bullet points or lists for scannability?

6. LOCAL ACCURACY Judge (Virginia Beach Specific):
   - Score 1-10 on local accuracy
   - Does it use "BPOL" instead of generic "business license"?
   - Are Virginia Beach URLs/resources current and correct?
   - Are local organization names accurate?

---

OUTPUT FORMAT (respond with ONLY this JSON, no other text):

{
  "readabilityScore": <1-10>,
  "readabilityIssues": ["specific issue 1", "specific issue 2"],
  "accuracyScore": <1-10>,
  "hallucinations": ["'Quote X' not found in source", "'Stat Y' unverifiable"],
  "grammarScore": <1-10>,
  "grammarFixes": ["Change 'X' to 'Y'", "Passive voice in paragraph 3"],
  "uniquenessScore": <1-10>,
  "clichesFound": ["Moreover", "Delve into"],
  "optimizationScore": <1-10>,
  "seoMissing": ["Keyword missing from first 100 words"],
  "localAccuracyScore": <1-10>,
  "localIssues": ["Uses 'business license' instead of 'BPOL'"],
  "overallScore": <1-10 average>,
  "passFail": "PASS" | "FAIL",
  "failReasons": ["Accuracy below ${EVALUATION_THRESHOLDS.accuracy}", "Too many AI cliches"]
}

PASS/FAIL RULES:
- FAIL if accuracyScore < ${EVALUATION_THRESHOLDS.accuracy}
- FAIL if uniquenessScore < ${EVALUATION_THRESHOLDS.uniqueness}
- FAIL if localAccuracyScore < ${EVALUATION_THRESHOLDS.localAccuracy}
- Otherwise PASS`
}

/**
 * Parse the JSON response from the evaluator
 */
function parseEvaluationResponse(response: string): Omit<EvaluationResult, 'evaluatedAt' | 'provider'> {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }

  jsonStr = jsonStr.trim()

  try {
    const parsed = JSON.parse(jsonStr)

    // Validate and normalize the response
    return {
      readabilityScore: Number(parsed.readabilityScore) || 5,
      accuracyScore: Number(parsed.accuracyScore) || 5,
      grammarScore: Number(parsed.grammarScore) || 5,
      uniquenessScore: Number(parsed.uniquenessScore) || 5,
      optimizationScore: Number(parsed.optimizationScore) || 5,
      localAccuracyScore: Number(parsed.localAccuracyScore) || 5,
      readabilityIssues: Array.isArray(parsed.readabilityIssues) ? parsed.readabilityIssues : [],
      hallucinations: Array.isArray(parsed.hallucinations) ? parsed.hallucinations : [],
      grammarFixes: Array.isArray(parsed.grammarFixes) ? parsed.grammarFixes : [],
      clichesFound: Array.isArray(parsed.clichesFound) ? parsed.clichesFound : [],
      seoMissing: Array.isArray(parsed.seoMissing) ? parsed.seoMissing : [],
      localIssues: Array.isArray(parsed.localIssues) ? parsed.localIssues : [],
      overallScore: Number(parsed.overallScore) || 5,
      passFail: parsed.passFail === 'PASS' ? 'PASS' : 'FAIL',
      failReasons: Array.isArray(parsed.failReasons) ? parsed.failReasons : [],
    }
  } catch {
    console.error('Failed to parse evaluation response:', response)
    throw new Error('Failed to parse evaluation response as JSON')
  }
}

/**
 * Evaluate an article draft using the Judge Swarm
 *
 * Uses Gemini 2.0 Flash for its large context window (1M tokens)
 * which allows including full source materials for accuracy checking
 */
export const evaluateArticle = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    draft: z.string().min(100, 'Draft must be at least 100 characters'),
    sourceMaterials: z.string().optional().default(''),
    primaryKeyword: z.string().min(1, 'Primary keyword is required'),
  }))
  .handler(async ({ data }): Promise<EvaluationResult> => {
    const prompt = buildEvaluationPrompt(
      data.draft,
      data.sourceMaterials,
      data.primaryKeyword
    )

    // Use Gemini for evaluation (large context window)
    const response = await generateWithGemini({
      prompt,
      systemPrompt: 'You are an expert editor. Output ONLY valid JSON, no other text.',
      maxTokens: 4096,
      temperature: 0.3, // Low temperature for consistent scoring
    })

    const evaluation = parseEvaluationResponse(response)

    // Verify pass/fail based on our thresholds
    const scores = {
      accuracy: evaluation.accuracyScore,
      uniqueness: evaluation.uniquenessScore,
      readability: evaluation.readabilityScore,
      grammar: evaluation.grammarScore,
      optimization: evaluation.optimizationScore,
      localAccuracy: evaluation.localAccuracyScore,
    }

    const shouldPass = evaluationPasses(scores)

    // Build fail reasons if necessary
    const failReasons: string[] = []
    if (evaluation.accuracyScore < EVALUATION_THRESHOLDS.accuracy) {
      failReasons.push(`Accuracy score ${evaluation.accuracyScore} below threshold ${EVALUATION_THRESHOLDS.accuracy}`)
    }
    if (evaluation.uniquenessScore < EVALUATION_THRESHOLDS.uniqueness) {
      failReasons.push(`Uniqueness score ${evaluation.uniquenessScore} below threshold ${EVALUATION_THRESHOLDS.uniqueness}`)
    }
    if (evaluation.localAccuracyScore < EVALUATION_THRESHOLDS.localAccuracy) {
      failReasons.push(`Local accuracy score ${evaluation.localAccuracyScore} below threshold ${EVALUATION_THRESHOLDS.localAccuracy}`)
    }

    return {
      ...evaluation,
      passFail: shouldPass ? 'PASS' : 'FAIL',
      failReasons: shouldPass ? [] : (failReasons.length > 0 ? failReasons : evaluation.failReasons),
      evaluatedAt: new Date().toISOString(),
      provider: 'gemini',
    }
  })

/**
 * Quick pre-flight checks that don't require AI
 * Run these before the full evaluation to catch obvious issues
 */
export function quickPreflightCheck(draft: string, primaryKeyword: string): {
  issues: string[]
  shouldProceed: boolean
} {
  const issues: string[] = []

  // Check for keyword in title (H1)
  const h1Match = draft.match(/^#\s+(.+)/m)
  if (h1Match && !h1Match[1].toLowerCase().includes(primaryKeyword.toLowerCase())) {
    issues.push(`Primary keyword "${primaryKeyword}" not found in H1 title`)
  }

  // Check for keyword in first 100 words
  const first100Words = draft.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
  if (!first100Words.includes(primaryKeyword.toLowerCase())) {
    issues.push(`Primary keyword "${primaryKeyword}" not found in first 100 words`)
  }

  // Check for AI cliches
  const foundCliches = AI_CLICHES.filter(cliche =>
    draft.toLowerCase().includes(cliche.toLowerCase())
  )
  if (foundCliches.length > 3) {
    issues.push(`Found ${foundCliches.length} AI cliches: ${foundCliches.slice(0, 3).join(', ')}...`)
  }

  // Check for "business license" without BPOL
  if (draft.toLowerCase().includes('business license') && !draft.includes('BPOL')) {
    issues.push('Uses "business license" without mentioning BPOL')
  }

  // Check word count
  const wordCount = draft.split(/\s+/).length
  if (wordCount < 1500) {
    issues.push(`Word count ${wordCount} is below recommended 1500`)
  }
  if (wordCount > 4000) {
    issues.push(`Word count ${wordCount} is above recommended 3500 - consider trimming`)
  }

  return {
    issues,
    shouldProceed: issues.length < 5 // Proceed to full eval if < 5 preflight issues
  }
}

/**
 * Format evaluation results for display or logging
 */
export function formatEvaluationSummary(result: EvaluationResult): string {
  const scoreBar = (score: number) => {
    const filled = '█'.repeat(score)
    const empty = '░'.repeat(10 - score)
    return `${filled}${empty} ${score}/10`
  }

  return `
## Article Evaluation Summary

**Overall: ${result.passFail}** (Score: ${result.overallScore}/10)

### Scores
- Readability:    ${scoreBar(result.readabilityScore)}
- Accuracy:       ${scoreBar(result.accuracyScore)}
- Grammar:        ${scoreBar(result.grammarScore)}
- Uniqueness:     ${scoreBar(result.uniquenessScore)}
- SEO:            ${scoreBar(result.optimizationScore)}
- Local Accuracy: ${scoreBar(result.localAccuracyScore)}

${result.passFail === 'FAIL' ? `### Fail Reasons\n${result.failReasons.map(r => `- ${r}`).join('\n')}` : ''}

${result.hallucinations.length > 0 ? `### Accuracy Issues\n${result.hallucinations.map(h => `- ⚠️ ${h}`).join('\n')}` : ''}

${result.clichesFound.length > 0 ? `### AI Cliches Found\n${result.clichesFound.map(c => `- "${c}"`).join('\n')}` : ''}

${result.localIssues.length > 0 ? `### Local Accuracy Issues\n${result.localIssues.map(i => `- ${i}`).join('\n')}` : ''}

${result.seoMissing.length > 0 ? `### SEO Issues\n${result.seoMissing.map(s => `- ${s}`).join('\n')}` : ''}

---
Evaluated: ${result.evaluatedAt}
Provider: ${result.provider}
`.trim()
}
