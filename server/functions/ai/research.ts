import { createServerFn } from '@tanstack/react-start'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { isPathWithinBase, logSecurityEvent } from '../../../lib/security/path-sanitizer'
import { researchInputSchema, validateInput } from '../../../lib/validation/schemas'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'

const RESEARCH_DIR = path.join(process.cwd(), 'content', 'research')

export interface ResearchInput {
  topic: string
  targetAudience?: string
  competitors?: string[]
}

export interface ResearchOutput {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  searchIntent: string
  competitorAnalysis: string
  outline: string[]
  targetWordCount: number
  rawContent: string
}

export function buildResearchPrompt(data: ResearchInput): string {
  const profile = buildContentProfile({
    topic: data.topic,
    primaryKeyword: data.topic,
  })
  const guidance = buildGuidanceBlock(profile)

  return `
${PROMPTS.research}

${guidance}

Topic: ${data.topic}
${data.targetAudience ? `Target Audience: ${data.targetAudience}` : ''}
${data.competitors?.length ? `Competitors to analyze: ${data.competitors.join(', ')}` : ''}

Provide a comprehensive research brief in markdown format.
`
}

export const runResearch = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(researchInputSchema, data))
  .handler(async ({ data }) => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    const prompt = buildResearchPrompt(data)

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.7,
    })

    // Parse the result to extract structured data
    const primaryMatch = result.content.match(/\*\*Primary Keyword\*\*:?\s*(.+)/i)
    const secondaryMatch = result.content.match(/\*\*Secondary Keywords?\*\*:?\s*(.+)/i)

    // Ensure research directory exists
    if (!fs.existsSync(RESEARCH_DIR)) {
      fs.mkdirSync(RESEARCH_DIR, { recursive: true })
    }

    // Save the research brief
    const slug = data.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 75)
    const filename = `brief-${slug}-${Date.now()}.md`
    const filePath = path.join(RESEARCH_DIR, filename)

    // Verify file path is within research directory
    if (!isPathWithinBase(filePath, RESEARCH_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    const fileContent = `---
topic: ${data.topic}
created: ${new Date().toISOString()}
provider: ${result.provider}
---

${result.content}
`

    fs.writeFileSync(filePath, fileContent, 'utf-8')

    return {
      topic: data.topic,
      primaryKeyword: primaryMatch?.[1]?.trim() ?? data.topic,
      secondaryKeywords: secondaryMatch?.[1]?.split(',').map(k => k.trim()) ?? [],
      searchIntent: 'informational',
      competitorAnalysis: '',
      outline: [],
      targetWordCount: 2500,
      rawContent: result.content,
      savedTo: filename,
      provider: result.provider
    }
  })
