import { createServerFn } from '@tanstack/react-start'
import { generate, type AIGenerateOptions, type AIResponse } from './index'
import { PROMPTS } from './prompts'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { updateWithFeedbackInputSchema, validateInput } from '../../../lib/validation/schemas'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'
import { anchorizeRawUrls } from '../../../lib/content-postprocess'
import { parseFrontmatter } from '../../../lib/markdown/frontmatter-parser'

export interface UpdateWithFeedbackResult {
  content: string
  provider: 'gemini' | 'anthropic'
}

type GenerateFn = (options: AIGenerateOptions) => Promise<AIResponse>

const PREAMBLE_PATTERNS = [
  /^okay,?\s*here'?s?\s*/i,
  /^sure,?\s*here'?s?\s*/i,
  /^here'?s?\s*(a|the|your)?\s*/i,
  /^i'?ve\s*(created|written|prepared|made|updated)\s*/i,
  /^below\s*is\s*/i,
  /^the\s*following\s*is\s*/i,
  /^as\s*requested,?\s*/i,
]

function stripPreamble(text: string): string {
  let result = text.trim()
  let changed = true

  while (changed) {
    changed = false
    for (const pattern of PREAMBLE_PATTERNS) {
      const before = result
      result = result.replace(pattern, '')
      if (result !== before) {
        changed = true
        result = result.trim()
      }
    }
  }

  return result
}

export async function updateWithFeedbackUsingGenerator(
  generateFn: GenerateFn,
  data: { content: string; feedback: string }
): Promise<UpdateWithFeedbackResult> {
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(data.content)
  const h1Match = body.match(/^#\s+(.+)$/m)
  const topic = typeof frontmatter.meta_title === 'string'
    ? frontmatter.meta_title
    : (h1Match?.[1] ?? 'Article update')
  const primaryKeyword = typeof frontmatter.primary_keyword === 'string'
    ? frontmatter.primary_keyword
    : topic

  const profile = buildContentProfile({
    topic,
    primaryKeyword,
    draft: body,
    feedback: data.feedback,
  })
  const guidance = buildGuidanceBlock(profile)

  const prompt = `
${PROMPTS.updateWithFeedback}

${guidance}

Feedback:
${data.feedback}

Original Content:
---
${data.content}
---
`

  const result = await generateFn({
    prompt,
    maxTokens: 8192,
    temperature: 0.4,
  })

  let newContent = result.content

  const frontmatterStart = newContent.indexOf('---')
  if (frontmatterStart > 0) {
    newContent = newContent.slice(frontmatterStart)
  }

  const bodyMatch = newContent.match(/^---[\s\S]*?---\n([\s\S]*)$/)
  let bodyContent = bodyMatch
    ? bodyMatch[1].trim()
    : newContent.replace(/^---[\s\S]*?---\n?/, '').trim()

  bodyContent = stripPreamble(bodyContent)
  bodyContent = anchorizeRawUrls(bodyContent)

  if (!bodyContent.startsWith('#')) {
    const firstHeadingIndex = bodyContent.search(/^#\s+/m)
    if (firstHeadingIndex > 0) {
      bodyContent = bodyContent.slice(firstHeadingIndex)
    }
  }

  return {
    content: bodyContent,
    provider: result.provider,
  }
}

export const updateWithFeedback = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(updateWithFeedbackInputSchema, data))
  .handler(async ({ data }): Promise<UpdateWithFeedbackResult> => {
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    return updateWithFeedbackUsingGenerator(generate, {
      content: data.content,
      feedback: data.feedback,
    })
  })
