import { createServerFn } from '@tanstack/react-start'
import { randomUUID } from 'crypto'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { isPathWithinBase, logSecurityEvent } from '../../../lib/security/path-sanitizer'
import { buildSeoSlugParts } from '../../../lib/seo/seo-slug'
import { writeInputSchema, validateInput } from '../../../lib/validation/schemas'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'

const DRAFTS_DIR = path.join(process.cwd(), 'content', 'drafts')

// Common AI preamble patterns to strip
const PREAMBLE_PATTERNS = [
  /^okay,?\s*here'?s?\s*/i,
  /^sure,?\s*here'?s?\s*/i,
  /^here'?s?\s*(a|the|your)?\s*/i,
  /^i'?ve\s*(created|written|prepared)\s*/i,
  /^below\s*is\s*/i,
  /^the\s*following\s*is\s*/i,
  /^as\s*requested,?\s*/i,
  /^based\s*on\s*(the|your)\s*(provided|given)?\s*(source\s*material|research|brief|guidelines|instructions)[^.]*[.,]\s*/i,
  /^a\s*comprehensive,?\s*SEO-optimized\s*article[^.]*[.,]\s*/i,
]

function stripPreamble(text: string): string {
  let result = text.trim()
  let changed = true

  // Keep stripping until no more patterns match
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

export interface WriteInput {
  topic: string
  primaryKeyword: string
  secondaryKeywords?: string[]
  outline?: string[]
  targetWordCount?: number
  researchBrief?: string
}

export function buildWritePrompt(data: WriteInput): string {
  const profile = buildContentProfile({
    topic: data.topic,
    primaryKeyword: data.primaryKeyword,
    secondaryKeywords: data.secondaryKeywords,
    outline: data.outline,
  })
  const guidance = buildGuidanceBlock(profile)

  return `
${PROMPTS.write}

${guidance}

Topic: ${data.topic}
Primary Keyword: ${data.primaryKeyword}
${data.secondaryKeywords?.length ? `Secondary Keywords: ${data.secondaryKeywords.join(', ')}` : ''}
Target Word Count: ${data.targetWordCount ?? 2500}+

${data.outline?.length ? `Suggested Outline:\n${data.outline.map((h, i) => `${i + 1}. ${h}`).join('\n')}` : ''}

${data.researchBrief ? `Research Brief:\n${data.researchBrief}` : ''}

Write a comprehensive, SEO-optimized article. Use markdown formatting.
Start with a compelling H1 title.
`
}

export const runWrite = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(writeInputSchema, data))
  .handler(async ({ data }) => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    const prompt = buildWritePrompt(data)

    const result = await generate({
      prompt,
      maxTokens: 8192,
      temperature: 0.7,
    })

    // Strip any preamble before the frontmatter
    let content = result.content
    const frontmatterStart = content.indexOf('---')
    if (frontmatterStart > 0) {
      // There's preamble before the frontmatter, strip it
      content = content.slice(frontmatterStart)
    }

    // Parse AI-generated frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let aiMetaTitle = ''
    let aiMetaDescription = ''

    if (frontmatterMatch) {
      const fmContent = frontmatterMatch[1]
      const titleMatch = fmContent.match(/meta_title:\s*(.+)/i)
      const descMatch = fmContent.match(/meta_description:\s*(.+)/i)
      aiMetaTitle = stripPreamble(titleMatch?.[1]?.trim() ?? '')
      aiMetaDescription = stripPreamble(descMatch?.[1]?.trim() ?? '')
      // Remove the AI frontmatter from content (we'll add our own complete one)
      content = content.slice(frontmatterMatch[0].length).trim()
    }

    // Strip any preamble from the beginning of the article body
    content = stripPreamble(content)

    // If content doesn't start with a heading, check if there's preamble before the first heading
    if (!content.startsWith('#')) {
      const firstHeadingIndex = content.search(/^#\s+/m)
      if (firstHeadingIndex > 0) {
        // There's text before the first heading - likely preamble, strip it
        content = content.slice(firstHeadingIndex)
      }
    }

    // Extract title from content (H1)
    const h1Match = content.match(/^#\s+(.+)$/m)
    const title = aiMetaTitle || (h1Match?.[1] ?? data.topic)

    // Generate meta description with fallbacks - strip preamble from it too
    let metaDescription = aiMetaDescription
    if (!metaDescription || metaDescription.toLowerCase().includes('here\'s') || metaDescription.toLowerCase().includes('okay')) {
      // AI preamble leaked into meta description, generate a clean one
      metaDescription = `${data.topic} - Your complete guide to ${data.primaryKeyword}. Learn everything you need to know.`
    }

    // Create slug and filename
    const { slug: generatedSlug, urlSlug } = buildSeoSlugParts(
      data.primaryKeyword,
      title || data.topic,
      data.secondaryKeywords ?? []
    )
    const slug = generatedSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 75)
    const date = new Date().toISOString().split('T')[0]
    const filename = `${slug}-${date}.md`
    const filePath = path.join(DRAFTS_DIR, filename)

    // Verify file path is within drafts directory
    if (!isPathWithinBase(filePath, DRAFTS_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    const articleId = randomUUID()

    // Build frontmatter with AI-generated meta or fallbacks
    const frontmatter = `---
article_id: ${articleId}
meta_title: ${title}
meta_description: ${metaDescription}
primary_keyword: ${data.primaryKeyword}
secondary_keywords: ${data.secondaryKeywords?.join(', ') ?? ''}
url_slug: ${urlSlug || `/blog/${slug}`}
published_date: ${date}
---
`

    // Scrub AI watermarks from content
    let cleanContent = content
      // Remove zero-width characters
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      // Replace em-dashes with regular dashes
      .replace(/—/g, '-')
      .replace(/–/g, '-')

    // Ensure drafts directory exists
    if (!fs.existsSync(DRAFTS_DIR)) {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true })
    }

    // Save the draft
    fs.writeFileSync(filePath, `${frontmatter}\n${cleanContent}`, 'utf-8')

    // Count words
    const wordCount = cleanContent.split(/\s+/).length

    return {
      success: true,
      id: articleId,
      title,
      slug,
      filename,
      wordCount,
      provider: result.provider
    }
  })
