import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { runSEOEvaluation, type SEOEvaluationResult } from '../ai/evaluateSEO'
import { findPostFileByIdentifier } from '../../utils/post-file-locator'

const isServer = typeof window === 'undefined'
const DRAFTS_DIR = isServer ? path.join(process.cwd(), 'content', 'drafts') : ''
const POSTS_DIR = isServer ? path.join(process.cwd(), 'content', 'posts') : ''

/**
 * Check SEO for any post/draft by slug
 * Works independently of the queue system
 */
export const checkSEOBySlug = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    slug: z.string(),
    directory: z.enum(['drafts', 'published']).default('drafts'),
  }))
  .handler(async ({ data }): Promise<{ success: boolean; seo: SEOEvaluationResult }> => {
    const dir = data.directory === 'published' ? POSTS_DIR : DRAFTS_DIR
    const match = findPostFileByIdentifier(dir, data.slug)
    if (!match) {
      throw new Error('File not found')
    }
    const filePath = match.filePath
    const content = match.content

    // Extract primary keyword from frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let primaryKeyword = ''
    if (fmMatch) {
      const kwMatch = fmMatch[1].match(/primary_keyword:\s*(.+)/i)
      primaryKeyword = kwMatch?.[1]?.trim() || ''
    }

    if (!primaryKeyword) {
      throw new Error('No primary keyword found in frontmatter')
    }

    const seo = runSEOEvaluation(content, primaryKeyword)

    return { success: true, seo }
  })

/**
 * Auto-fix SEO for any post/draft by slug
 * Works independently of the queue system
 */
export const autoFixSEOBySlug = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    slug: z.string(),
    directory: z.enum(['drafts', 'published']).default('drafts'),
  }))
  .handler(async ({ data }): Promise<{
    fixed: string[]
    skipped: string[]
    oldScore: number
    newScore: number
    seo: SEOEvaluationResult
  }> => {
    const dir = data.directory === 'published' ? POSTS_DIR : DRAFTS_DIR
    const match = findPostFileByIdentifier(dir, data.slug)
    if (!match) {
      throw new Error('File not found')
    }
    const filePath = match.filePath
    let content = match.content

    // Extract primary keyword from frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let primaryKeyword = ''
    let currentSlug = match.slug || data.slug
    if (fmMatch) {
      const kwMatch = fmMatch[1].match(/primary_keyword:\s*(.+)/i)
      primaryKeyword = kwMatch?.[1]?.trim() || ''
      const slugMatch = fmMatch[1].match(/url_slug:\s*(.+)/i)
      if (slugMatch) {
        currentSlug = slugMatch[1].trim().replace(/^\/blog\//, '')
      }
    }

    if (!primaryKeyword) {
      throw new Error('No primary keyword found in frontmatter')
    }

    // Get initial SEO score
    const initialSeo = runSEOEvaluation(content, primaryKeyword)
    const oldScore = initialSeo.score

    const allFixes: string[] = []
    const skipped: string[] = []

    // 1. Fix keyword placement
    const keywordPlacementCheck = initialSeo.checks.find(c => c.name === 'Keyword Placement')
    if (keywordPlacementCheck && !keywordPlacementCheck.passed) {
      const result = fixKeywordPlacement(content, primaryKeyword)
      content = result.content
      allFixes.push(...result.fixes)
    }

    // 2. Fix keyword density (if too high)
    const densityCheck = initialSeo.checks.find(c => c.name === 'Keyword Density')
    if (densityCheck && !densityCheck.passed && densityCheck.message.includes('too high')) {
      const densityMatch = densityCheck.message.match(/(\d+\.?\d*)%/)
      const currentDensity = densityMatch ? parseFloat(densityMatch[1]) : 0
      const result = fixKeywordDensity(content, primaryKeyword, currentDensity)
      content = result.content
      allFixes.push(...result.fixes)
    }

    // 3. Add internal links
    const internalLinksCheck = initialSeo.checks.find(c => c.name === 'Internal Links')
    if (internalLinksCheck && !internalLinksCheck.passed) {
      const result = addInternalLinks(content, currentSlug)
      content = result.content
      if (result.fixes[0]?.startsWith('No')) {
        skipped.push(result.fixes[0])
      } else {
        allFixes.push(...result.fixes)
      }
    }

    // Save the fixed content
    fs.writeFileSync(filePath, content, 'utf-8')

    // Re-evaluate SEO
    const newSeo = runSEOEvaluation(content, primaryKeyword)

    return {
      fixed: allFixes,
      skipped,
      oldScore,
      newScore: newSeo.score,
      seo: newSeo
    }
  })

interface FixResult {
  fixed: string[]
  skipped: string[]
  newScore: number
  oldScore: number
}

/**
 * Get all published posts for internal linking
 */
function getExistingPosts(): { slug: string; title: string; keywords: string[] }[] {
  const posts: { slug: string; title: string; keywords: string[] }[] = []

  if (!fs.existsSync(POSTS_DIR)) return posts

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'))

  for (const file of files) {
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8')
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

    if (frontmatterMatch) {
      const fm = frontmatterMatch[1]
      const titleMatch = fm.match(/meta_title:\s*(.+)/i)
      const slugMatch = fm.match(/url_slug:\s*(.+)/i)
      const primaryKw = fm.match(/primary_keyword:\s*(.+)/i)
      const secondaryKw = fm.match(/secondary_keywords:\s*(.+)/i)

      const keywords: string[] = []
      if (primaryKw) keywords.push(primaryKw[1].trim().toLowerCase())
      if (secondaryKw) {
        keywords.push(...secondaryKw[1].split(',').map(k => k.trim().toLowerCase()))
      }

      posts.push({
        slug: slugMatch?.[1]?.trim() || file.replace('.md', ''),
        title: titleMatch?.[1]?.trim() || file.replace('.md', ''),
        keywords
      })
    }
  }

  return posts
}

/**
 * Find relevant posts for internal linking based on content
 */
function findRelevantPosts(
  content: string,
  currentSlug: string,
  existingPosts: { slug: string; title: string; keywords: string[] }[]
): { slug: string; title: string; keyword: string }[] {
  const contentLower = content.toLowerCase()
  const matches: { slug: string; title: string; keyword: string; score: number }[] = []

  for (const post of existingPosts) {
    // Don't link to self
    if (post.slug.includes(currentSlug) || currentSlug.includes(post.slug)) continue

    for (const keyword of post.keywords) {
      if (keyword.length < 4) continue // Skip short keywords
      if (contentLower.includes(keyword)) {
        matches.push({
          slug: post.slug,
          title: post.title,
          keyword,
          score: keyword.length // Prefer longer keyword matches
        })
        break // One match per post
      }
    }
  }

  // Sort by score and return top 3
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ slug, title, keyword }) => ({ slug, title, keyword }))
}

/**
 * Fix keyword placement in frontmatter and H1
 */
function fixKeywordPlacement(
  content: string,
  keyword: string
): { content: string; fixes: string[] } {
  const fixes: string[] = []
  let newContent = content
  const keywordLower = keyword.toLowerCase()

  // Parse frontmatter
  const fmMatch = newContent.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return { content: newContent, fixes }

  let frontmatter = fmMatch[1]
  const bodyStart = fmMatch[0].length
  let body = newContent.slice(bodyStart)

  // Fix meta_title if keyword missing
  const titleMatch = frontmatter.match(/meta_title:\s*(.+)/i)
  if (titleMatch && !titleMatch[1].toLowerCase().includes(keywordLower)) {
    // Prepend keyword to title
    const oldTitle = titleMatch[1].trim()
    const keywordCapitalized = keyword.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ')

    // Create new title with keyword
    let newTitle = oldTitle
    if (oldTitle.length + keyword.length < 55) {
      newTitle = `${keywordCapitalized}: ${oldTitle}`
    } else {
      // Replace first part with keyword
      newTitle = `${keywordCapitalized} Guide | ${oldTitle.slice(0, 30)}...`
    }
    newTitle = newTitle.slice(0, 60) // Ensure max length

    frontmatter = frontmatter.replace(
      /meta_title:\s*.+/i,
      `meta_title: ${newTitle}`
    )
    fixes.push('Added keyword to meta title')
  }

  // Fix meta_description if keyword missing
  const descMatch = frontmatter.match(/meta_description:\s*(.+)/i)
  if (descMatch && !descMatch[1].toLowerCase().includes(keywordLower)) {
    const oldDesc = descMatch[1].trim()
    // Prepend keyword phrase naturally
    const newDesc = `Learn ${keyword} with our comprehensive guide. ${oldDesc}`.slice(0, 160)
    frontmatter = frontmatter.replace(
      /meta_description:\s*.+/i,
      `meta_description: ${newDesc}`
    )
    fixes.push('Added keyword to meta description')
  }

  // Fix H1 if keyword missing
  const h1Match = body.match(/^#\s+(.+)/m)
  if (h1Match && !h1Match[1].toLowerCase().includes(keywordLower)) {
    const keywordCapitalized = keyword.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ')
    const newH1 = `# ${keywordCapitalized}: ${h1Match[1]}`
    body = body.replace(/^#\s+.+/m, newH1)
    fixes.push('Added keyword to H1 heading')
  }

  // Fix first H2 if no H2 contains keyword
  const h2Matches = body.match(/^##\s+.+/gm)
  if (h2Matches) {
    const hasKeywordInH2 = h2Matches.some(h2 =>
      h2.toLowerCase().includes(keywordLower)
    )
    if (!hasKeywordInH2 && h2Matches.length > 0) {
      // Add keyword to first H2
      const firstH2 = h2Matches[0]
      const h2Text = firstH2.replace(/^##\s+/, '')
      const keywordCapitalized = keyword.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ')
      const newH2 = `## ${h2Text} - ${keywordCapitalized}`
      body = body.replace(firstH2, newH2)
      fixes.push('Added keyword to first H2 subheading')
    }
  }

  newContent = `---\n${frontmatter}\n---${body}`
  return { content: newContent, fixes }
}

/**
 * Reduce keyword stuffing by replacing some instances with synonyms
 */
function fixKeywordDensity(
  content: string,
  keyword: string,
  currentDensity: number
): { content: string; fixes: string[] } {
  const fixes: string[] = []

  if (currentDensity <= 2.5) {
    return { content, fixes }
  }

  // Generate synonyms/variations based on keyword
  const synonyms = generateSynonyms(keyword)

  if (synonyms.length === 0) {
    return { content, fixes }
  }

  let newContent = content
  const keywordRegex = new RegExp(keyword, 'gi')
  const matches = content.match(keywordRegex)

  if (!matches) return { content, fixes }

  // Calculate how many to replace (aim for ~1.5% density)
  const words = content.split(/\s+/).length
  const targetOccurrences = Math.floor((words * 0.015) / keyword.split(/\s+/).length)
  const toReplace = Math.max(0, matches.length - targetOccurrences)

  if (toReplace > 0) {
    let replaced = 0
    let synonymIndex = 0

    // Replace every other occurrence after the first few
    newContent = content.replace(keywordRegex, (match, offset) => {
      // Keep first 3 occurrences
      if (replaced < 3) {
        replaced++
        return match
      }

      // Replace alternating occurrences
      if (replaced % 2 === 0 && synonymIndex < synonyms.length) {
        const synonym = synonyms[synonymIndex % synonyms.length]
        synonymIndex++
        replaced++
        // Preserve case
        if (match[0] === match[0].toUpperCase()) {
          return synonym.charAt(0).toUpperCase() + synonym.slice(1)
        }
        return synonym
      }

      replaced++
      return match
    })

    if (synonymIndex > 0) {
      fixes.push(`Replaced ${synonymIndex} keyword instances with synonyms to reduce density`)
    }
  }

  return { content: newContent, fixes }
}

/**
 * Generate synonyms/variations for a keyword
 */
function generateSynonyms(keyword: string): string[] {
  const keywordLower = keyword.toLowerCase()
  const synonymMap: Record<string, string[]> = {
    'how to start a business': [
      'launching a business',
      'starting a company',
      'opening a business',
      'beginning your venture',
      'establishing a business'
    ],
    'virginia beach': [
      'VB',
      'the Virginia Beach area',
      'this coastal city',
      'the Hampton Roads region'
    ],
    'business': [
      'company',
      'venture',
      'enterprise',
      'startup',
      'firm'
    ],
    'start': [
      'launch',
      'begin',
      'establish',
      'open',
      'create'
    ],
    'guide': [
      'resource',
      'walkthrough',
      'tutorial',
      'handbook'
    ]
  }

  // Find matching synonyms
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (keywordLower.includes(key)) {
      return synonyms
    }
  }

  // Generic business synonyms
  if (keywordLower.includes('business')) {
    return synonymMap['business']
  }

  return []
}

/**
 * Add internal links to content
 */
function addInternalLinks(
  content: string,
  currentSlug: string
): { content: string; fixes: string[] } {
  const fixes: string[] = []
  const existingPosts = getExistingPosts()

  if (existingPosts.length === 0) {
    return { content, fixes: ['No existing posts found for internal linking'] }
  }

  const relevantPosts = findRelevantPosts(content, currentSlug, existingPosts)

  if (relevantPosts.length === 0) {
    return { content, fixes: ['No relevant posts found for internal linking'] }
  }

  let newContent = content
  let linksAdded = 0

  for (const post of relevantPosts) {
    // Find the keyword in content and wrap first occurrence with link
    const keywordRegex = new RegExp(`\\b(${post.keyword})\\b`, 'i')
    const match = newContent.match(keywordRegex)

    if (match && !newContent.includes(`](${post.slug})`)) {
      // Only link if not already linking to this post
      newContent = newContent.replace(keywordRegex, `[$1](${post.slug})`)
      linksAdded++
    }
  }

  if (linksAdded > 0) {
    fixes.push(`Added ${linksAdded} internal link${linksAdded > 1 ? 's' : ''} to related content`)
  }

  return { content: newContent, fixes }
}

/**
 * Auto-fix SEO issues in a draft
 */
export const autoFixSEO = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number(),
  }))
  .handler(async ({ data }): Promise<FixResult & { seo: SEOEvaluationResult }> => {
    const { getQueueItemById } = await import('../../../lib/seo-planner.server')
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    if (!article.assignedPostSlug && !article.assignedArticleId) {
      throw new Error('No draft file linked to this article')
    }

    // Find the draft file
    const files = fs.readdirSync(DRAFTS_DIR)
    let draftFile: string | undefined

    if (article.assignedArticleId) {
      for (const file of files) {
        if (!file.endsWith('.md')) continue
        const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8')
        if (content.includes(`article_id: ${article.assignedArticleId}`)) {
          draftFile = file
          break
        }
      }
    }

    if (!draftFile && article.assignedPostSlug) {
      draftFile = files.find(f => f.includes(article.assignedPostSlug!))
    }

    if (!draftFile) {
      throw new Error('Draft file not found')
    }

    const draftPath = path.join(DRAFTS_DIR, draftFile)
    let content = fs.readFileSync(draftPath, 'utf-8')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    // Get initial SEO score
    const initialSeo = runSEOEvaluation(content, primaryKeyword)
    const oldScore = initialSeo.score

    const allFixes: string[] = []
    const skipped: string[] = []

    // 1. Fix keyword placement
    const keywordPlacementCheck = initialSeo.checks.find(c => c.name === 'Keyword Placement')
    if (keywordPlacementCheck && !keywordPlacementCheck.passed) {
      const result = fixKeywordPlacement(content, primaryKeyword)
      content = result.content
      allFixes.push(...result.fixes)
    }

    // 2. Fix keyword density (if too high)
    const densityCheck = initialSeo.checks.find(c => c.name === 'Keyword Density')
    if (densityCheck && !densityCheck.passed && densityCheck.message.includes('too high')) {
      // Extract current density from message
      const densityMatch = densityCheck.message.match(/(\d+\.?\d*)%/)
      const currentDensity = densityMatch ? parseFloat(densityMatch[1]) : 0
      const result = fixKeywordDensity(content, primaryKeyword, currentDensity)
      content = result.content
      allFixes.push(...result.fixes)
    }

    // 3. Add internal links
    const internalLinksCheck = initialSeo.checks.find(c => c.name === 'Internal Links')
    if (internalLinksCheck && !internalLinksCheck.passed) {
      const result = addInternalLinks(content, article.assignedPostSlug || '')
      content = result.content
      if (result.fixes[0]?.startsWith('No')) {
        skipped.push(result.fixes[0])
      } else {
        allFixes.push(...result.fixes)
      }
    }

    // Save the fixed content
    fs.writeFileSync(draftPath, content, 'utf-8')

    // Re-evaluate SEO
    const newSeo = runSEOEvaluation(content, primaryKeyword)

    return {
      fixed: allFixes,
      skipped,
      oldScore,
      newScore: newSeo.score,
      seo: newSeo
    }
  })
