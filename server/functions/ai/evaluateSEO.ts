import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/**
 * SEO Check Result
 */
export interface SEOCheck {
  name: string
  passed: boolean
  score: number // 0-100
  message: string
  suggestion?: string
}

/**
 * Complete SEO Evaluation Result
 */
export interface SEOEvaluationResult {
  score: number // 0-100
  passFail: 'PASS' | 'FAIL'
  checks: SEOCheck[]
  summary: string
  evaluatedAt: string
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {}
  const match = content.match(/^---\n([\s\S]*?)\n---/)

  if (match) {
    const lines = match[1].split('\n')
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        frontmatter[key] = value
      }
    }
  }

  return frontmatter
}

/**
 * Extract body content (without frontmatter)
 */
function getBodyContent(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '')
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Calculate keyword density
 */
function calculateKeywordDensity(content: string, keyword: string): number {
  const words = countWords(content)
  if (words === 0) return 0

  const keywordLower = keyword.toLowerCase()
  const contentLower = content.toLowerCase()

  // Count keyword occurrences (as phrase)
  const regex = new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const matches = contentLower.match(regex)
  const keywordCount = matches ? matches.length : 0

  // Keyword density = (keyword occurrences * keyword word count) / total words * 100
  const keywordWords = keyword.split(/\s+/).length
  return (keywordCount * keywordWords / words) * 100
}

/**
 * Extract all headings from markdown
 */
function extractHeadings(content: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim()
      })
    }
  }

  return headings
}

/**
 * Extract all links from markdown
 */
function extractLinks(content: string): { text: string; url: string; isInternal: boolean }[] {
  const links: { text: string; url: string; isInternal: boolean }[] = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2]
    const isInternal = url.startsWith('/') || url.startsWith('#')
    links.push({
      text: match[1],
      url,
      isInternal
    })
  }

  return links
}

/**
 * Extract images from markdown
 */
function extractImages(content: string): { alt: string; src: string }[] {
  const images: { alt: string; src: string }[] = []
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g

  let match
  while ((match = imgRegex.exec(content)) !== null) {
    images.push({
      alt: match[1],
      src: match[2]
    })
  }

  return images
}

/**
 * Check keyword placement in content
 */
function checkKeywordPlacement(
  content: string,
  keyword: string,
  frontmatter: Record<string, string>,
  headings: { level: number; text: string }[]
): SEOCheck {
  const keywordLower = keyword.toLowerCase()
  const body = getBodyContent(content)
  const first150Words = body.split(/\s+/).slice(0, 150).join(' ').toLowerCase()

  const placements: string[] = []
  const missing: string[] = []

  // Check title/H1
  const h1 = headings.find(h => h.level === 1)
  if (h1?.text.toLowerCase().includes(keywordLower)) {
    placements.push('H1 title')
  } else {
    missing.push('H1 title')
  }

  // Check meta title
  if (frontmatter.meta_title?.toLowerCase().includes(keywordLower)) {
    placements.push('meta title')
  } else {
    missing.push('meta title')
  }

  // Check meta description
  if (frontmatter.meta_description?.toLowerCase().includes(keywordLower)) {
    placements.push('meta description')
  } else {
    missing.push('meta description')
  }

  // Check first 150 words
  if (first150Words.includes(keywordLower)) {
    placements.push('first 150 words')
  } else {
    missing.push('first 150 words')
  }

  // Check H2s
  const h2s = headings.filter(h => h.level === 2)
  const h2WithKeyword = h2s.some(h => h.text.toLowerCase().includes(keywordLower))
  if (h2WithKeyword) {
    placements.push('H2 subheading')
  } else if (h2s.length > 0) {
    missing.push('any H2 subheading')
  }

  const score = (placements.length / 5) * 100
  const passed = placements.length >= 3

  return {
    name: 'Keyword Placement',
    passed,
    score,
    message: passed
      ? `Keyword found in: ${placements.join(', ')}`
      : `Keyword missing from: ${missing.join(', ')}`,
    suggestion: !passed
      ? `Add "${keyword}" to: ${missing.slice(0, 2).join(', ')}`
      : undefined
  }
}

/**
 * Check keyword density
 */
function checkKeywordDensity(content: string, keyword: string): SEOCheck {
  const body = getBodyContent(content)
  const density = calculateKeywordDensity(body, keyword)

  let passed = false
  let message = ''
  let suggestion: string | undefined
  let score = 0

  if (density < 0.5) {
    message = `Keyword density ${density.toFixed(2)}% is too low (target: 0.5-2.5%)`
    suggestion = `Add more natural mentions of "${keyword}"`
    score = density * 100
  } else if (density > 3) {
    message = `Keyword density ${density.toFixed(2)}% is too high - risk of keyword stuffing`
    suggestion = 'Reduce keyword repetition, use synonyms instead'
    score = Math.max(0, 100 - (density - 3) * 20)
  } else {
    passed = true
    message = `Keyword density ${density.toFixed(2)}% is optimal`
    score = 100
  }

  return { name: 'Keyword Density', passed, score, message, suggestion }
}

/**
 * Check meta title length
 */
function checkMetaTitle(frontmatter: Record<string, string>): SEOCheck {
  const title = frontmatter.meta_title || ''
  const length = title.length

  if (length === 0) {
    return {
      name: 'Meta Title',
      passed: false,
      score: 0,
      message: 'Meta title is missing',
      suggestion: 'Add a compelling meta title (50-60 characters)'
    }
  }

  if (length < 30) {
    return {
      name: 'Meta Title',
      passed: false,
      score: 40,
      message: `Meta title is too short (${length} chars, target: 50-60)`,
      suggestion: 'Expand your title to include more descriptive keywords'
    }
  }

  if (length > 70) {
    return {
      name: 'Meta Title',
      passed: false,
      score: 60,
      message: `Meta title may be truncated (${length} chars, target: 50-60)`,
      suggestion: 'Shorten to ensure full display in search results'
    }
  }

  const inRange = length >= 50 && length <= 60
  return {
    name: 'Meta Title',
    passed: true,
    score: inRange ? 100 : 80,
    message: `Meta title length: ${length} chars ${inRange ? '(optimal)' : '(acceptable)'}`
  }
}

/**
 * Check meta description length
 */
function checkMetaDescription(frontmatter: Record<string, string>): SEOCheck {
  const desc = frontmatter.meta_description || ''
  const length = desc.length

  if (length === 0) {
    return {
      name: 'Meta Description',
      passed: false,
      score: 0,
      message: 'Meta description is missing',
      suggestion: 'Add a compelling meta description (150-160 characters)'
    }
  }

  if (length < 100) {
    return {
      name: 'Meta Description',
      passed: false,
      score: 40,
      message: `Meta description is too short (${length} chars, target: 150-160)`,
      suggestion: 'Add more detail about what readers will learn'
    }
  }

  if (length > 170) {
    return {
      name: 'Meta Description',
      passed: false,
      score: 60,
      message: `Meta description may be truncated (${length} chars, target: 150-160)`,
      suggestion: 'Shorten to ensure full display in search results'
    }
  }

  const inRange = length >= 150 && length <= 160
  return {
    name: 'Meta Description',
    passed: true,
    score: inRange ? 100 : 80,
    message: `Meta description length: ${length} chars ${inRange ? '(optimal)' : '(acceptable)'}`
  }
}

/**
 * Check heading structure
 */
function checkHeadingStructure(headings: { level: number; text: string }[]): SEOCheck {
  const issues: string[] = []

  // Check for H1
  const h1Count = headings.filter(h => h.level === 1).length
  if (h1Count === 0) {
    issues.push('Missing H1 heading')
  } else if (h1Count > 1) {
    issues.push(`Multiple H1s found (${h1Count}) - should have only 1`)
  }

  // Check for H2s
  const h2Count = headings.filter(h => h.level === 2).length
  if (h2Count < 2) {
    issues.push('Add more H2 subheadings for better structure')
  }

  // Check heading hierarchy
  let prevLevel = 0
  for (const h of headings) {
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      issues.push(`Skipped heading level: H${prevLevel} to H${h.level}`)
      break
    }
    prevLevel = h.level
  }

  const passed = issues.length === 0
  const score = Math.max(0, 100 - issues.length * 25)

  return {
    name: 'Heading Structure',
    passed,
    score,
    message: passed
      ? `Good structure: 1 H1, ${h2Count} H2s, proper hierarchy`
      : issues.join('; '),
    suggestion: !passed ? issues[0] : undefined
  }
}

/**
 * Check content length
 */
function checkContentLength(content: string): SEOCheck {
  const body = getBodyContent(content)
  const wordCount = countWords(body)

  if (wordCount < 800) {
    return {
      name: 'Content Length',
      passed: false,
      score: (wordCount / 800) * 50,
      message: `Content is thin (${wordCount} words, minimum: 800)`,
      suggestion: 'Add more depth, examples, or sections to improve comprehensiveness'
    }
  }

  if (wordCount < 1500) {
    return {
      name: 'Content Length',
      passed: true,
      score: 70,
      message: `Content length acceptable (${wordCount} words, target: 1500-3000)`,
      suggestion: 'Consider expanding to 1500+ words for better ranking potential'
    }
  }

  if (wordCount > 4000) {
    return {
      name: 'Content Length',
      passed: true,
      score: 80,
      message: `Content is long (${wordCount} words) - ensure it stays engaging`,
      suggestion: 'Consider breaking into a series or adding more visual breaks'
    }
  }

  return {
    name: 'Content Length',
    passed: true,
    score: 100,
    message: `Excellent content length: ${wordCount} words`
  }
}

/**
 * Check internal linking
 */
function checkInternalLinks(links: { text: string; url: string; isInternal: boolean }[]): SEOCheck {
  const internalLinks = links.filter(l => l.isInternal && !l.url.startsWith('#'))
  const count = internalLinks.length

  if (count === 0) {
    return {
      name: 'Internal Links',
      passed: false,
      score: 0,
      message: 'No internal links found',
      suggestion: 'Add 2-5 internal links to related content on your site'
    }
  }

  if (count < 2) {
    return {
      name: 'Internal Links',
      passed: true,
      score: 50,
      message: `Only ${count} internal link found`,
      suggestion: 'Add more internal links to improve site navigation and SEO'
    }
  }

  return {
    name: 'Internal Links',
    passed: true,
    score: Math.min(100, 60 + count * 10),
    message: `${count} internal links found`
  }
}

/**
 * Check external linking
 */
function checkExternalLinks(links: { text: string; url: string; isInternal: boolean }[]): SEOCheck {
  const externalLinks = links.filter(l => !l.isInternal)
  const count = externalLinks.length

  if (count === 0) {
    return {
      name: 'External Links',
      passed: false,
      score: 30,
      message: 'No external links to authoritative sources',
      suggestion: 'Add 1-3 links to authoritative external sources to build credibility'
    }
  }

  // Check for anchor text quality (not "click here", "here", "link")
  const poorAnchors = externalLinks.filter(l =>
    /^(click here|here|link|this|read more)$/i.test(l.text.trim())
  )

  if (poorAnchors.length > 0) {
    return {
      name: 'External Links',
      passed: true,
      score: 70,
      message: `${count} external links, but some have poor anchor text`,
      suggestion: 'Use descriptive anchor text instead of "click here"'
    }
  }

  return {
    name: 'External Links',
    passed: true,
    score: 100,
    message: `${count} external links with good anchor text`
  }
}

/**
 * Check image optimization
 */
function checkImages(images: { alt: string; src: string }[]): SEOCheck {
  if (images.length === 0) {
    return {
      name: 'Image Optimization',
      passed: true,
      score: 70,
      message: 'No images in content',
      suggestion: 'Consider adding relevant images to improve engagement'
    }
  }

  const missingAlt = images.filter(img => !img.alt || img.alt.trim() === '')

  if (missingAlt.length > 0) {
    return {
      name: 'Image Optimization',
      passed: false,
      score: ((images.length - missingAlt.length) / images.length) * 100,
      message: `${missingAlt.length} of ${images.length} images missing alt text`,
      suggestion: 'Add descriptive alt text to all images'
    }
  }

  return {
    name: 'Image Optimization',
    passed: true,
    score: 100,
    message: `All ${images.length} images have alt text`
  }
}

/**
 * Check URL/slug quality
 */
function checkUrlSlug(frontmatter: Record<string, string>, keyword: string): SEOCheck {
  const slug = frontmatter.url_slug || ''
  const issues: string[] = []

  if (!slug) {
    return {
      name: 'URL/Slug',
      passed: false,
      score: 0,
      message: 'URL slug is missing',
      suggestion: 'Add a SEO-friendly URL slug'
    }
  }

  // Check length
  if (slug.length > 75) {
    issues.push('URL is too long (over 75 chars)')
  }

  // Check for keyword
  const slugLower = slug.toLowerCase()
  const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-')
  if (!slugLower.includes(keywordSlug) && !slugLower.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
    // Check if at least main keyword words are present
    const keywordParts = keyword.toLowerCase().split(/\s+/)
    const hasMainParts = keywordParts.filter(p => p.length > 3).some(p => slugLower.includes(p))
    if (!hasMainParts) {
      issues.push('URL does not contain primary keyword')
    }
  }

  // Check for underscores or special chars
  if (slug.includes('_')) {
    issues.push('URL contains underscores (use hyphens instead)')
  }

  // Check for uppercase
  if (slug !== slug.toLowerCase()) {
    issues.push('URL should be lowercase')
  }

  const passed = issues.length === 0
  const score = Math.max(0, 100 - issues.length * 25)

  return {
    name: 'URL/Slug',
    passed,
    score,
    message: passed ? 'URL is SEO-friendly' : issues.join('; '),
    suggestion: !passed ? issues[0] : undefined
  }
}

/**
 * Check for lists and formatting
 */
function checkFormatting(content: string): SEOCheck {
  const body = getBodyContent(content)

  // Check for bullet lists
  const hasBullets = /^[\*\-]\s/m.test(body)
  // Check for numbered lists
  const hasNumbered = /^\d+\.\s/m.test(body)
  // Check for bold/strong
  const hasBold = /\*\*[^*]+\*\*/.test(body) || /__[^_]+__/.test(body)

  const features: string[] = []
  const missing: string[] = []

  if (hasBullets) features.push('bullet lists')
  else missing.push('bullet lists')

  if (hasNumbered) features.push('numbered lists')

  if (hasBold) features.push('bold text')
  else missing.push('bold emphasis')

  const score = features.length >= 2 ? 100 : features.length === 1 ? 60 : 30
  const passed = features.length >= 1

  return {
    name: 'Content Formatting',
    passed,
    score,
    message: passed
      ? `Good formatting: ${features.join(', ')}`
      : 'Content lacks formatting elements',
    suggestion: !passed || missing.length > 0
      ? `Add ${missing.slice(0, 2).join(' and ')} for better scannability`
      : undefined
  }
}

/**
 * Run comprehensive SEO evaluation
 */
export function runSEOEvaluation(content: string, primaryKeyword: string): SEOEvaluationResult {
  const frontmatter = parseFrontmatter(content)
  const headings = extractHeadings(content)
  const links = extractLinks(content)
  const images = extractImages(content)

  const checks: SEOCheck[] = [
    checkKeywordPlacement(content, primaryKeyword, frontmatter, headings),
    checkKeywordDensity(content, primaryKeyword),
    checkMetaTitle(frontmatter),
    checkMetaDescription(frontmatter),
    checkHeadingStructure(headings),
    checkContentLength(content),
    checkInternalLinks(links),
    checkExternalLinks(links),
    checkImages(images),
    checkUrlSlug(frontmatter, primaryKeyword),
    checkFormatting(content),
  ]

  // Calculate overall score (weighted)
  const weights: Record<string, number> = {
    'Keyword Placement': 1.5,
    'Keyword Density': 1.0,
    'Meta Title': 1.2,
    'Meta Description': 1.2,
    'Heading Structure': 1.0,
    'Content Length': 1.0,
    'Internal Links': 0.8,
    'External Links': 0.6,
    'Image Optimization': 0.5,
    'URL/Slug': 0.8,
    'Content Formatting': 0.6,
  }

  let totalWeight = 0
  let weightedScore = 0

  for (const check of checks) {
    const weight = weights[check.name] || 1.0
    totalWeight += weight
    weightedScore += check.score * weight
  }

  const score = Math.round(weightedScore / totalWeight)
  const passedCount = checks.filter(c => c.passed).length
  const passFail = score >= 70 && passedCount >= 7 ? 'PASS' : 'FAIL'

  // Build summary
  const criticalIssues = checks.filter(c => !c.passed && c.score < 50)
  const warnings = checks.filter(c => c.passed && c.score < 80)

  let summary = `SEO Score: ${score}/100 (${passFail})\n`
  summary += `Checks passed: ${passedCount}/${checks.length}\n`

  if (criticalIssues.length > 0) {
    summary += `\nCritical issues:\n${criticalIssues.map(c => `• ${c.name}: ${c.suggestion || c.message}`).join('\n')}`
  }

  if (warnings.length > 0) {
    summary += `\nWarnings:\n${warnings.map(c => `• ${c.name}: ${c.suggestion || c.message}`).join('\n')}`
  }

  return {
    score,
    passFail,
    checks,
    summary,
    evaluatedAt: new Date().toISOString()
  }
}

/**
 * Server function for SEO evaluation
 */
export const evaluateSEO = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    content: z.string().min(100, 'Content must be at least 100 characters'),
    primaryKeyword: z.string().min(1, 'Primary keyword is required'),
  }))
  .handler(async ({ data }): Promise<SEOEvaluationResult> => {
    return runSEOEvaluation(data.content, data.primaryKeyword)
  })
