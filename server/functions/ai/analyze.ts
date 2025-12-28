import { createServerFn } from '@tanstack/react-start'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../../lib/security/path-sanitizer'
import { analyzeInputSchema, validateInput } from '../../../lib/validation/schemas'
import { findPostFileByIdentifier } from '../../utils/post-file-locator'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface AnalyzeInput {
  slug: string
  directory: 'published' | 'drafts'
  competitors?: string[]
}

export interface ContentGap {
  topic: string
  priority: 'high' | 'medium' | 'low'
  reason: string
}

export interface UpdateOpportunity {
  section: string
  issue: string
  suggestion: string
}

export interface AnalyzeResult {
  contentGaps: ContentGap[]
  updateOpportunities: UpdateOpportunity[]
  internalLinkSuggestions: string[]
  newArticleIdeas: string[]
  rawAnalysis: string
  provider: 'gemini' | 'anthropic'
}

export const runAnalyze = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(analyzeInputSchema, data))
  .handler(async ({ data }) => {
    // Rate limiting check
    const ip = 'default' // Server-side, use default IP tracking
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_analysis)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_analysis)
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

    const content = match.content

    // Also read other published content for internal linking context
    const publishedDir = path.join(CONTENT_DIR, 'published')
    let otherPosts: string[] = []
    if (fs.existsSync(publishedDir)) {
      otherPosts = fs.readdirSync(publishedDir)
        .filter(f => f.endsWith('.md') && f !== match.file)
        .map(f => {
          const postContent = fs.readFileSync(path.join(publishedDir, f), 'utf-8')
          const titleMatch = postContent.match(/^#\s+(.+)$/m) || postContent.match(/meta_title:\s*(.+)/m)
          return titleMatch?.[1] ?? f.replace('.md', '')
        })
    }

    const prompt = `
${PROMPTS.analyze}

Content to analyze:
---
${content}
---

${data.competitors?.length ? `Competitors to consider: ${data.competitors.join(', ')}` : ''}

Other published posts on this site (for internal linking):
${otherPosts.length > 0 ? otherPosts.map(p => `- ${p}`).join('\n') : 'No other posts yet'}

Provide your analysis in the following format:

## Content Gaps
For each gap, provide:
- Topic: [what's missing]
- Priority: high/medium/low
- Reason: [why this matters]

## Update Opportunities
For each section that needs updating:
- Section: [section name]
- Issue: [what's wrong]
- Suggestion: [how to fix]

## Internal Linking Opportunities
- [List specific phrases that could link to other posts]

## New Article Ideas
- [List related topics that could be separate articles]
`

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.5,
    })

    // Parse content gaps
    const contentGaps: ContentGap[] = []
    const gapsSection = result.content.match(/## Content Gaps\n([\s\S]*?)(?=\n## |$)/i)
    if (gapsSection) {
      const gapMatches = gapsSection[1].matchAll(/- Topic:\s*(.+)\n\s*- Priority:\s*(high|medium|low)\n\s*- Reason:\s*(.+)/gi)
      for (const match of gapMatches) {
        contentGaps.push({
          topic: match[1].trim(),
          priority: match[2].toLowerCase() as 'high' | 'medium' | 'low',
          reason: match[3].trim()
        })
      }
    }

    // Parse update opportunities
    const updateOpportunities: UpdateOpportunity[] = []
    const updatesSection = result.content.match(/## Update Opportunities\n([\s\S]*?)(?=\n## |$)/i)
    if (updatesSection) {
      const updateMatches = updatesSection[1].matchAll(/- Section:\s*(.+)\n\s*- Issue:\s*(.+)\n\s*- Suggestion:\s*(.+)/gi)
      for (const match of updateMatches) {
        updateOpportunities.push({
          section: match[1].trim(),
          issue: match[2].trim(),
          suggestion: match[3].trim()
        })
      }
    }

    // Parse internal link suggestions
    const linksSection = result.content.match(/## Internal Linking Opportunities\n([\s\S]*?)(?=\n## |$)/i)
    const internalLinkSuggestions = linksSection?.[1]
      ?.match(/^[-*]\s+(.+)$/gm)
      ?.map(l => l.replace(/^[-*]\s+/, '')) ?? []

    // Parse new article ideas
    const ideasSection = result.content.match(/## New Article Ideas\n([\s\S]*?)(?=\n## |$)/i)
    const newArticleIdeas = ideasSection?.[1]
      ?.match(/^[-*]\s+(.+)$/gm)
      ?.map(l => l.replace(/^[-*]\s+/, '')) ?? []

    return {
      contentGaps,
      updateOpportunities,
      internalLinkSuggestions,
      newArticleIdeas,
      rawAnalysis: result.content,
      provider: result.provider
    }
  })
