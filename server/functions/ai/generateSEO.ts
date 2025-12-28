import { createServerFn } from '@tanstack/react-start'
import { generate, type AIGenerateOptions, type AIResponse } from './index'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { generateSEOInputSchema, validateInput } from '../../../lib/validation/schemas'
import { buildSEOMetadata, parseJsonMetadata } from '../../../lib/seo/seo-metadata'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'
import { cleanMetaDescription } from '../../../lib/content-postprocess'

export interface GenerateSEOInput {
  content: string
  existingTitle?: string
  existingKeyword?: string
}

export interface GenerateSEOResult {
  metaTitle: string
  metaDescription: string
  primaryKeyword: string
  secondaryKeywords: string[]
  provider: 'gemini' | 'anthropic'
}

type GenerateFn = (options: AIGenerateOptions) => Promise<AIResponse>

function extractTitleFromContent(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\n/, '').trim()
  const h1Match = body.match(/^#\s+(.+)$/m)
  if (h1Match?.[1]) {
    return h1Match[1].trim().replace(/[*_~`]+/g, '')
  }
  const firstLine = body.split('\n').map(line => line.trim()).find(Boolean)
  if (!firstLine) return ''
  return firstLine.replace(/^#+\s*/, '').replace(/[*_~`]+/g, '').trim()
}

export function buildSeoPrompt(data: GenerateSEOInput, attempt: number): string {
  const currentYear = new Date().getFullYear()
  const nextYear = currentYear + 1
  const retryNote = attempt > 1
    ? '\nThis is a retry. The previous response was invalid JSON. Output ONLY valid JSON with all required fields.\n'
    : ''

  const topic = data.existingTitle || extractTitleFromContent(data.content) || 'SEO Metadata'
  const profile = buildContentProfile({
    topic,
    primaryKeyword: data.existingKeyword ?? topic,
    draft: data.content,
  })
  const guidance = buildGuidanceBlock(profile)

  return `Analyze this article and generate SEO metadata.

IMPORTANT: Today's date is ${new Date().toISOString().split('T')[0]}. If including a year in titles/descriptions, use ${nextYear} for forward-looking content (guides, tips) or ${currentYear} for current news/events.

${guidance}

ARTICLE CONTENT:
${data.content.slice(0, 4000)}

${data.existingTitle ? `Current title: ${data.existingTitle}` : ''}
${data.existingKeyword ? `Target keyword: ${data.existingKeyword}` : ''}
${retryNote}

Return ONLY valid JSON in the exact shape below. No markdown, no code fences, no extra text.

{
  "metaTitle": "Compelling title, aim 50-60 chars, never truncate mid-word",
  "metaDescription": "150-155 chars, not the first sentence, include keyword naturally, end with benefit/CTA",
  "primaryKeyword": "2-4 word phrase people would search for",
  "secondaryKeywords": ["3-5 related search terms"]
}

CRITICAL RULES FOR metaTitle:
- NEVER cut off mid-word or mid-phrase
- Better a complete 65-char title than a truncated 55-char one
- If you can't fit everything, rephrase more concisely instead of truncating

RULES FOR metaDescription:
- Must be DIFFERENT from the article's opening sentence
- Should summarize the VALUE the reader gets, not describe the content
- Include a hook or benefit (why should they click?)
- End with action words or promise of value
- Example good: "Discover how Virginia MOCA's move impacts local artists and what it means for VB's creative future. Find farewell events and legacy highlights."
- Example bad: "The Virginia Museum of Contemporary Art has been a cornerstone of Virginia Beach arts for decades."
`
}

function isJsonMetadataComplete(parsed: ReturnType<typeof parseJsonMetadata>): boolean {
  return !!parsed
    && !!parsed.metaTitle
    && !!parsed.metaDescription
    && !!parsed.primaryKeyword
    && Array.isArray(parsed.secondaryKeywords)
    && parsed.secondaryKeywords.length > 0
}

export async function generateSEOMetadataWithGenerator(
  generateFn: GenerateFn,
  data: GenerateSEOInput
): Promise<GenerateSEOResult> {
  const first = await generateFn({
    prompt: buildSeoPrompt(data, 1),
    maxTokens: 500,
    temperature: 0.4,
  })

  let chosen = first
  const firstParsed = parseJsonMetadata(first.content)

  if (!isJsonMetadataComplete(firstParsed)) {
    const retry = await generateFn({
      prompt: buildSeoPrompt(data, 2),
      maxTokens: 500,
      temperature: 0.2,
    })
    chosen = retry
  }

  const parsed = buildSEOMetadata(chosen.content, {
    content: data.content,
    existingTitle: data.existingTitle,
    existingKeyword: data.existingKeyword,
  })

  const cleanedDescription = cleanMetaDescription(data.content, parsed.metaDescription)

  if (process.env.NODE_ENV !== 'production') {
    const missing = !cleanedDescription || !parsed.primaryKeyword || parsed.secondaryKeywords.length === 0
    if (missing) {
      console.warn('[SEO PARSE] Missing fields', {
        metaTitle: parsed.metaTitle,
        metaDescription: cleanedDescription,
        primaryKeyword: parsed.primaryKeyword,
        secondaryKeywords: parsed.secondaryKeywords,
        raw: chosen.content,
      })
    }
  }

  return {
    metaTitle: parsed.metaTitle,
    metaDescription: cleanedDescription,
    primaryKeyword: parsed.primaryKeyword,
    secondaryKeywords: parsed.secondaryKeywords,
    provider: chosen.provider,
  }
}

export const generateSEOMetadata = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(generateSEOInputSchema, data))
  .handler(async ({ data }): Promise<GenerateSEOResult> => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_seo)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_seo)
      throw new RateLimitError(retryAfterMs, 0)
    }

    return generateSEOMetadataWithGenerator(generate, data)
  })
