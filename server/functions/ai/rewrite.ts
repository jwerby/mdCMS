import { createServerFn } from '@tanstack/react-start'
import { randomUUID } from 'crypto'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../../lib/security/path-sanitizer'
import { parseFrontmatter, serializeFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { rewriteInputSchema, validateInput } from '../../../lib/validation/schemas'
import { findPostFileByIdentifier } from '../../utils/post-file-locator'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'
import { anchorizeRawUrls } from '../../../lib/content-postprocess'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface RewriteInput {
  slug: string
  directory: 'published' | 'drafts'
  targetKeyword?: string
  instructions?: string
}

export interface RewriteResult {
  success: boolean
  id: string
  originalWordCount: number
  newWordCount: number
  filename: string
  provider: 'gemini' | 'anthropic'
}

export function buildRewritePrompt(data: {
  originalContent: string
  targetKeyword?: string
  instructions?: string
}): string {
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(data.originalContent)
  const h1Match = body.match(/^#\s+(.+)$/m)
  const topic = typeof frontmatter.meta_title === 'string'
    ? frontmatter.meta_title
    : (h1Match?.[1] ?? 'Rewrite')
  const primaryKeyword = typeof frontmatter.primary_keyword === 'string'
    ? frontmatter.primary_keyword
    : (data.targetKeyword ?? topic)
  const secondaryKeywords = typeof frontmatter.secondary_keywords === 'string'
    ? frontmatter.secondary_keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []
  const guidance = buildGuidanceBlock(buildContentProfile({
    topic,
    primaryKeyword,
    secondaryKeywords,
    draft: body,
    feedback: data.instructions,
  }))

  return `
${PROMPTS.rewrite}

${guidance}

${data.targetKeyword ? `Target Keyword: ${data.targetKeyword}` : ''}
${data.instructions ? `Additional Instructions: ${data.instructions}` : ''}

Original Content:
---
${data.originalContent}
---

Rewrite this content to improve its SEO performance while maintaining the core message.
Return the complete rewritten article in markdown format with frontmatter.
`
}

export function postprocessRewrittenContent(input: {
  content: string
  fallbackArticleId: string
}): string {
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(input.content)
  const existingArticleId = typeof frontmatter.article_id === 'string' ? frontmatter.article_id : ''
  const articleId = existingArticleId || input.fallbackArticleId
  const updatedFrontmatter = existingArticleId ? frontmatter : { ...frontmatter, article_id: articleId }
  const anchoredBody = anchorizeRawUrls(body)
  return `${serializeFrontmatter(updatedFrontmatter)}\n${anchoredBody}`
}

export const runRewrite = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(rewriteInputSchema, data))
  .handler(async ({ data }) => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    // Sanitize and validate the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    // Find and read the file
    const dir = path.join(CONTENT_DIR, data.directory)

    // Verify directory path is within content directory
    if (!isPathWithinBase(dir, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { dir })
      throw new Error('Invalid directory')
    }

    const match = findPostFileByIdentifier(dir, sanitized.sanitized)
    if (!match) {
      throw new Error('Post not found')
    }
    const filePath = match.filePath

    // Verify file path is within content directory
    if (!isPathWithinBase(filePath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    const originalContent = match.content
    const { frontmatter: originalFrontmatter } = parseFrontmatter<Record<string, unknown>>(originalContent)
    const originalArticleId = typeof originalFrontmatter.article_id === 'string' ? originalFrontmatter.article_id : ''

    // Count original words (excluding frontmatter)
    const contentWithoutFrontmatter = originalContent.replace(/^---[\s\S]*?---\n/, '')
    const originalWordCount = contentWithoutFrontmatter.split(/\s+/).length

    const prompt = buildRewritePrompt({
      originalContent,
      targetKeyword: data.targetKeyword,
      instructions: data.instructions,
    })

    const result = await generate({
      prompt,
      maxTokens: 8192,
      temperature: 0.7,
    })

    // Scrub AI watermarks from content
    let cleanContent = result.content
      // Remove zero-width characters
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      // Replace em-dashes with regular dashes
      .replace(/—/g, '-')
      .replace(/–/g, '-')

    // If the rewritten content doesn't have frontmatter, preserve original
    if (!cleanContent.startsWith('---')) {
      const frontmatterMatch = originalContent.match(/^---[\s\S]*?---\n/)
      if (frontmatterMatch) {
        cleanContent = frontmatterMatch[0] + '\n' + cleanContent
      }
    }

    // Ensure article_id is preserved (or created if missing)
    const { frontmatter: rewrittenFrontmatter } = parseFrontmatter<Record<string, unknown>>(cleanContent)
    const existingArticleId = typeof rewrittenFrontmatter.article_id === 'string' ? rewrittenFrontmatter.article_id : ''
    const articleId = existingArticleId || originalArticleId || randomUUID()
    cleanContent = postprocessRewrittenContent({
      content: cleanContent,
      fallbackArticleId: articleId,
    })

    // Save the rewritten content
    fs.writeFileSync(filePath, cleanContent, 'utf-8')

    // Count new words
    const newContentWithoutFrontmatter = cleanContent.replace(/^---[\s\S]*?---\n/, '')
    const newWordCount = newContentWithoutFrontmatter.split(/\s+/).length

    return {
      success: true,
      id: articleId,
      originalWordCount,
      newWordCount,
      filename: match.file,
      provider: result.provider
    }
  })
