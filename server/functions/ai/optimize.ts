import { createServerFn } from '@tanstack/react-start'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../../lib/security/path-sanitizer'
import { optimizeInputSchema, applyFixesInputSchema, applyValidationFixesInputSchema, validateInput } from '../../../lib/validation/schemas'
import { findPostFileByIdentifier } from '../../utils/post-file-locator'
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'

const isServer = typeof window === 'undefined'
const CONTENT_DIR = isServer ? path.join(process.cwd(), 'content') : ''
const CONTEXT_DIR = isServer ? path.join(process.cwd(), 'context') : ''

// Brand terms configuration
interface BrandTermsConfig {
  description: string
  terms: Record<string, string>
  exceptions: string[]
  notes: string
}

// Validation issue found in content
export interface ValidationIssue {
  type: 'brand_term' | 'capitalization' | 'style'
  found: string
  expected: string
  count: number
  locations: string[]
}

// Load brand terms config
function loadBrandTerms(): BrandTermsConfig | null {
  const configPath = path.join(CONTEXT_DIR, 'brand-terms.json')
  if (!fs.existsSync(configPath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return null
  }
}

// Validate content against brand terms
function validateContent(content: string): ValidationIssue[] {
  const config = loadBrandTerms()
  if (!config) return []

  const issues: ValidationIssue[] = []

  // Split content into frontmatter and body
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const frontmatter = frontmatterMatch?.[1] ?? ''
  const body = frontmatterMatch?.[2] ?? content

  // Check each brand term
  for (const [incorrect, correct] of Object.entries(config.terms)) {
    // Skip if the incorrect and correct are the same (case-sensitive)
    if (incorrect === correct) continue

    // Create case-insensitive regex to find the term
    // But only match if it's NOT already correctly capitalized
    const escapedIncorrect = incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedCorrect = correct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Find all occurrences in body that aren't correctly capitalized
    const regex = new RegExp(`\\b${escapedIncorrect}\\b`, 'gi')
    const matches: string[] = []
    const locations: string[] = []

    let match
    while ((match = regex.exec(body)) !== null) {
      const foundText = match[0]
      // Only flag if it's not already correct
      if (foundText !== correct) {
        matches.push(foundText)
        // Get context around the match (20 chars before and after)
        const start = Math.max(0, match.index - 20)
        const end = Math.min(body.length, match.index + foundText.length + 20)
        const context = body.slice(start, end).replace(/\n/g, ' ').trim()
        if (!locations.includes(`...${context}...`)) {
          locations.push(`...${context}...`)
        }
      }
    }

    if (matches.length > 0) {
      issues.push({
        type: 'brand_term',
        found: matches[0], // Show first occurrence as example
        expected: correct,
        count: matches.length,
        locations: locations.slice(0, 3) // Limit to 3 examples
      })
    }
  }

  return issues
}

// Common AI preamble patterns to strip
const PREAMBLE_PATTERNS = [
  /^okay,?\s*here'?s?\s*/i,
  /^sure,?\s*here'?s?\s*/i,
  /^here'?s?\s*(a|the|your)?\s*/i,
  /^i'?ve\s*(created|written|prepared|applied|made|updated)\s*/i,
  /^below\s*is\s*/i,
  /^the\s*following\s*is\s*/i,
  /^as\s*requested,?\s*/i,
  /^based\s*on\s*(the|your)\s*(provided|given)?\s*(source\s*material|research|brief|guidelines|instructions|recommendations)[^.]*[.,]\s*/i,
  /^a\s*comprehensive,?\s*SEO-optimized\s*article[^.]*[.,]\s*/i,
  /^the\s*(improved|updated|revised|optimized)\s*(version|content|article)[^.]*[.,]\s*/i,
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

export interface OptimizeInput {
  slug: string
  directory: 'published' | 'drafts'
}

export interface ScoreBreakdown {
  readability: number
  seo: number
  engagement: number
  originality: number
}

export interface OptimizeResult {
  overall: number
  scores: ScoreBreakdown
  issues: string[]
  recommendations: string[]
  validationIssues: ValidationIssue[]
  rawAnalysis: string
  provider: 'gemini' | 'anthropic'
}

// (file resolution handled by findPostFileByIdentifier)

export const runOptimize = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(optimizeInputSchema, data))
  .handler(async ({ data }) => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_seo)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_seo)
      throw new RateLimitError(retryAfterMs, 0)
    }

    // Sanitize and validate the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    // Find and read the file using same logic as posts.ts
    const dir = path.join(CONTENT_DIR, data.directory)

    // Verify directory path is within content directory
    if (!isPathWithinBase(dir, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { dir })
      throw new Error('Invalid directory')
    }

    const match = findPostFileByIdentifier(dir, sanitized.sanitized)
    if (!match) {
      throw new Error(`Post not found: ${sanitized.sanitized} in ${data.directory}`)
    }

    const filePath = match.filePath

    // Verify file path is within content directory
    if (!isPathWithinBase(filePath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    const content = match.content

    const prompt = `
${PROMPTS.optimize}

Content to analyze:
---
${content}
---

Provide your analysis in the following format:
## Overall Score: X/100

## Readability: X/25
[Issues and recommendations]

## SEO: X/25
[Issues and recommendations]

## Engagement: X/25
[Issues and recommendations]

## Originality: X/25
[Issues and recommendations]

## Top 3 Priority Fixes
1. ...
2. ...
3. ...
`

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.3,
    })

    // Parse scores from response
    const overallMatch = result.content.match(/Overall Score:?\s*(\d+)/i)
    const readabilityMatch = result.content.match(/Readability:?\s*(\d+)/i)
    const seoMatch = result.content.match(/SEO:?\s*(\d+)/i)
    const engagementMatch = result.content.match(/Engagement:?\s*(\d+)/i)
    const originalityMatch = result.content.match(/Originality:?\s*(\d+)/i)

    // Extract issues (lines starting with - or * under issues sections)
    const issueMatches = result.content.match(/^[-*]\s+.+$/gm) ?? []

    // Extract recommendations from Priority Fixes section
    const prioritySection = result.content.match(/## Top 3 Priority Fixes\n([\s\S]*?)(?=\n##|$)/i)
    const recommendations = prioritySection?.[1]
      ?.match(/^\d+\.\s+.+$/gm)
      ?.map(r => r.replace(/^\d+\.\s+/, '')) ?? []

    // Run content validation for brand term issues
    const validationIssues = validateContent(content)

    return {
      overall: parseInt(overallMatch?.[1] ?? '0', 10),
      scores: {
        readability: parseInt(readabilityMatch?.[1] ?? '0', 10),
        seo: parseInt(seoMatch?.[1] ?? '0', 10),
        engagement: parseInt(engagementMatch?.[1] ?? '0', 10),
        originality: parseInt(originalityMatch?.[1] ?? '0', 10),
      },
      issues: issueMatches.map(i => i.replace(/^[-*]\s+/, '')),
      recommendations,
      validationIssues,
      rawAnalysis: result.content,
      provider: result.provider
    }
  })

// Apply validation fixes (brand terms) - no AI needed
export interface ApplyValidationFixesInput {
  content: string
  issues: ValidationIssue[]
}

export interface ApplyValidationFixesResult {
  content: string
  fixedCount: number
}

export const applyValidationFixes = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(applyValidationFixesInputSchema, data))
  .handler(async ({ data }): Promise<ApplyValidationFixesResult> => {
    // Rate limiting check (general rate - no AI usage)
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.general)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.general)
      throw new RateLimitError(retryAfterMs, 0)
    }

    let content = data.content
    let fixedCount = 0

    for (const issue of data.issues) {
      if (issue.type === 'brand_term') {
        // Create regex to match the incorrect term (case-insensitive, word boundary)
        const escapedFound = issue.found.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedFound}\\b`, 'gi')

        const before = content
        content = content.replace(regex, issue.expected)

        if (content !== before) {
          fixedCount += issue.count
        }
      }
    }

    return {
      content,
      fixedCount
    }
  })

// Apply optimization fixes to content (returns new content without saving)
export interface ApplyFixesInput {
  content: string
  recommendations: string[]
  frontmatter: Record<string, string>
}

export interface ApplyFixesResult {
  content: string
  provider: 'gemini' | 'anthropic'
}

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

export function buildApplyFixesPrompt(data: ApplyFixesInput): string {
  const topic = data.frontmatter.meta_title || extractTitleFromContent(data.content) || 'Article'
  const primaryKeyword = data.frontmatter.primary_keyword || topic
  const secondaryKeywords = data.frontmatter.secondary_keywords
    ? data.frontmatter.secondary_keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []
  const guidance = buildGuidanceBlock(buildContentProfile({
    topic,
    primaryKeyword,
    secondaryKeywords,
    draft: data.content,
  }))

  const fmLines = ['---']
  for (const [key, value] of Object.entries(data.frontmatter)) {
    if (value) fmLines.push(`${key}: ${value}`)
  }
  fmLines.push('---')
  const frontmatterStr = fmLines.join('\n')
  const fullContent = `${frontmatterStr}\n${data.content}`

  return `
${PROMPTS.applyFixes}

${guidance}

Here are the specific improvements to apply:
${data.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Original Content:
---
${fullContent}
---

Apply these improvements and return the complete improved article.
`
}

export const applyOptimizationFixes = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(applyFixesInputSchema, data))
  .handler(async ({ data }): Promise<ApplyFixesResult> => {
    // Rate limiting check
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_seo)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_seo)
      throw new RateLimitError(retryAfterMs, 0)
    }

    const prompt = buildApplyFixesPrompt(data)

    const result = await generate({
      prompt,
      maxTokens: 8192,
      temperature: 0.4,
    })

    // Extract just the body content (remove frontmatter since we'll preserve the original)
    let newContent = result.content

    // Strip any preamble before the frontmatter
    const frontmatterStart = newContent.indexOf('---')
    if (frontmatterStart > 0) {
      newContent = newContent.slice(frontmatterStart)
    }

    // Remove the frontmatter block to get just the body
    const bodyMatch = newContent.match(/^---[\s\S]*?---\n([\s\S]*)$/)
    let bodyContent = bodyMatch ? bodyMatch[1].trim() : newContent.replace(/^---[\s\S]*?---\n?/, '').trim()

    // Strip AI preamble from the body content
    bodyContent = stripPreamble(bodyContent)

    // If content doesn't start with a heading, check if there's preamble before the first heading
    if (!bodyContent.startsWith('#')) {
      const firstHeadingIndex = bodyContent.search(/^#\s+/m)
      if (firstHeadingIndex > 0) {
        bodyContent = bodyContent.slice(firstHeadingIndex)
      }
    }

    return {
      content: bodyContent,
      provider: result.provider
    }
  })
