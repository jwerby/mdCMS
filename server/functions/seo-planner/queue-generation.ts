import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { generate } from '../ai/index'
import { getQueueItemById, updateQueueItem } from '../../../lib/seo-planner.server'
import { togglePublish, getPostById } from '../posts'
import { evaluateArticle, quickPreflightCheck, formatEvaluationSummary, type EvaluationResult } from '../ai/evaluateArticle'
import { runSEOEvaluation, type SEOEvaluationResult } from '../ai/evaluateSEO'
import { refineArticle } from '../ai/refineArticle'
import { buildSeoSlugParts } from '../../../lib/seo/seo-slug'
import fs from 'fs'
import path from 'path'

const DRAFTS_DIR = path.join(process.cwd(), 'content', 'drafts')
const RESEARCH_DIR = path.join(process.cwd(), 'content', 'research')

// Maximum refinement attempts before giving up
const MAX_REFINEMENT_ATTEMPTS = 2

// Generate research brief for a queue item
export const generateResearchFromQueue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number()
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    const prompt = `You are an SEO research specialist. Analyze this topic and provide a comprehensive research brief.

Topic: ${article.title}
Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${keywords.slice(1).join(', ')}
${article.instructions ? `\n## IMPORTANT RESEARCH INSTRUCTIONS:\n${article.instructions}\n` : ''}
${article.notes ? `Additional Context: ${article.notes}` : ''}

Provide:
1. **Search Intent**: What users are looking for when they search this
2. **Target Audience**: Who this content is for
3. **Key Questions to Answer**: Top 5-7 questions users have about this topic
4. **Competitor Insights**: What top-ranking content covers
5. **Unique Angle**: How to differentiate this content
6. **Suggested Outline**: H2/H3 structure for comprehensive coverage
7. **Target Word Count**: Recommended length based on topic depth
8. **Internal Linking Opportunities**: Related topics to link to
${article.instructions ? '\n9. **Required Resources**: Include specific links/resources as instructed above' : ''}

Format as markdown with clear sections.`

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.7
    })

    // Save research to file
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 75)
    const filename = `brief-${slug}-${Date.now()}.md`
    const filePath = path.join(RESEARCH_DIR, filename)

    if (!fs.existsSync(RESEARCH_DIR)) {
      fs.mkdirSync(RESEARCH_DIR, { recursive: true })
    }

    const fileContent = `---
article_id: ${article.id}
title: ${article.title}
created: ${new Date().toISOString()}
provider: ${result.provider}
---

${result.content}`

    fs.writeFileSync(filePath, fileContent, 'utf-8')

    // Update article with research notes and move to research status
    updateQueueItem(data.articleId, {
      status: 'research',
      notes: `${article.notes || ''}\n\n---\n## Research Brief (${result.provider})\n${result.content}`.trim()
    })

    return {
      success: true,
      content: result.content,
      savedTo: filename,
      provider: result.provider
    }
  })

// Generate outline for a queue item
export const generateOutlineFromQueue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number()
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    // Extract any existing research from notes
    const hasResearch = article.notes?.includes('## Research Brief')

    const prompt = `You are an expert content strategist. Create a detailed article outline.

Topic: ${article.title}
Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${keywords.slice(1).join(', ')}
${article.instructions ? `\n## IMPORTANT INSTRUCTIONS:\n${article.instructions}\n` : ''}
${hasResearch ? `Research Notes:\n${article.notes}` : ''}

Create a comprehensive outline that includes:

1. **Title Suggestions**: 3 compelling title options (include primary keyword)

2. **Meta Description**: 155 chars max, compelling and keyword-optimized

3. **Introduction Hook**: A compelling opening angle (2-3 sentences describing the approach)

4. **Article Structure**:
   - H2 sections with brief description of content
   - H3 subsections where needed
   - Estimated word count per section

5. **Key Points to Cover**: Bullet points of essential information

6. **Examples/Case Studies**: Specific examples to include

7. **Call-to-Action**: How to end the article

8. **Internal Links**: Suggest related topics to link to
${article.instructions ? '\n9. **Required Resources**: Plan where to incorporate specific links/resources per instructions above' : ''}

Format as clear markdown. This outline should be detailed enough that a writer can produce a comprehensive article from it.`

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.7
    })

    // Update article with outline and move to outline status
    const existingNotes = article.notes || ''
    const separator = existingNotes ? '\n\n---\n' : ''

    updateQueueItem(data.articleId, {
      status: 'outline',
      notes: `${existingNotes}${separator}## Article Outline (${result.provider})\n${result.content}`.trim()
    })

    return {
      success: true,
      content: result.content,
      provider: result.provider
    }
  })

// Generate full draft for a queue item
export const generateDraftFromQueue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number()
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    const prompt = `You are an expert SEO content writer. Write a comprehensive, engaging article.

ABSOLUTELY FORBIDDEN - NEVER DO THESE:
- Do NOT start with "Okay", "Sure", "Here's", or ANY conversational preamble
- Do NOT include phrases like "based on the guidelines" or "SEO-optimized article"
- Do NOT add explanations about what you're doing
- Do NOT overuse the primary keyword (max 8-12 times in entire article)

Topic: ${article.title}
Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${keywords.slice(1).join(', ')}
${article.instructions ? `\n## CRITICAL INSTRUCTIONS (MUST FOLLOW):\n${article.instructions}\n` : ''}
${article.notes ? `Research & Outline:\n${article.notes}` : ''}

## CRITICAL SEO REQUIREMENTS (MUST FOLLOW EXACTLY):

### 1. Meta Title (50-60 chars)
- MUST contain the exact primary keyword "${primaryKeyword}"
- Example: "${primaryKeyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}: Complete Guide [2026]"

### 2. Meta Description (150-160 chars)
- MUST contain the exact primary keyword "${primaryKeyword}"
- Include a call-to-action
- Example: "Learn ${primaryKeyword} with our step-by-step guide. Get expert tips, resources, and actionable advice to succeed."

### 3. H1 Title
- MUST contain the exact primary keyword "${primaryKeyword}"
- Make it compelling and descriptive

### 4. First Paragraph (within first 100 words)
- MUST contain the exact primary keyword "${primaryKeyword}" naturally
- Hook the reader immediately

### 5. Keyword Density (CRITICAL - aim for 1-1.5%)
- Use "${primaryKeyword}" only 8-12 times in the entire article
- Use variations and synonyms instead of repeating: "${keywords.slice(1).join('", "')}"
- NEVER stuff keywords - it hurts SEO

### 6. At Least ONE H2 Must Contain the Primary Keyword
- Example: "## How to ${primaryKeyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"

### 7. Internal/External Links
- Include 2-3 placeholder internal links: [related topic](/blog/related-topic)
- Include 1-2 external links to authoritative sources (government, official resources)

START YOUR RESPONSE EXACTLY LIKE THIS (first 3 characters must be ---):
---
meta_title: [50-60 chars with primary keyword]
meta_description: [150-160 chars with primary keyword and CTA]
---

# [Title with primary keyword]

[First paragraph with primary keyword in first 100 words...]

Requirements:
1. **Length**: 2000-3000 words (comprehensive but not bloated)
2. **Structure**: Clear H2/H3 hierarchy with logical flow
3. **SEO**: Natural keyword integration - use synonyms to avoid stuffing
4. **Engagement**: Uses stories, examples, and actionable advice
5. **Formatting**: Includes bullets, numbered lists, bold key points
6. **Actionable**: Every section should provide value the reader can use
7. **Links**: Include internal link placeholders and external authoritative links
${article.instructions ? '8. **Required Resources**: Include all specific links/resources per instructions above' : ''}

End with a strong conclusion and call-to-action.`

    const result = await generate({
      prompt,
      maxTokens: 8192,
      temperature: 0.7
    })

    // Process the content
    let content = result.content

    // Strip any preamble before the frontmatter
    const frontmatterStart = content.indexOf('---')
    if (frontmatterStart > 0) {
      content = content.slice(frontmatterStart)
    }

    // Parse AI-generated frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let metaTitle = article.title
    let metaDescription = ''

    if (frontmatterMatch) {
      const fmContent = frontmatterMatch[1]
      const titleMatch = fmContent.match(/meta_title:\s*(.+)/i)
      const descMatch = fmContent.match(/meta_description:\s*(.+)/i)
      metaTitle = titleMatch?.[1]?.trim() ?? article.title
      metaDescription = descMatch?.[1]?.trim() ?? ''
      content = content.slice(frontmatterMatch[0].length).trim()
    }

    // Clean content
    let cleanContent = content
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/—/g, '-')
      .replace(/–/g, '-')

    // Create the draft file
    const { slug: generatedSlug, urlSlug } = buildSeoSlugParts(
      primaryKeyword,
      metaTitle,
      keywords.slice(1)
    )
    const slug = generatedSlug || metaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 75)
    const date = new Date().toISOString().split('T')[0]
    const filename = `${slug}-${date}.md`
    const filePath = path.join(DRAFTS_DIR, filename)

    // Generate a UUID for this article
    const articleId = randomUUID()

    if (!fs.existsSync(DRAFTS_DIR)) {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true })
    }

    const frontmatter = `---
article_id: ${articleId}
meta_title: ${metaTitle}
meta_description: ${metaDescription || `Complete guide to ${primaryKeyword}`}
primary_keyword: ${primaryKeyword}
secondary_keywords: ${keywords.slice(1).join(', ')}
url_slug: ${urlSlug || `/blog/${slug}`}
published_date: ${date}
queue_article_id: ${article.id}
---`

    fs.writeFileSync(filePath, `${frontmatter}\n\n${cleanContent}`, 'utf-8')

    // Update queue item to draft status and link to the file (both slug and UUID)
    updateQueueItem(data.articleId, {
      status: 'draft',
      assignedPostSlug: slug,
      assignedArticleId: articleId
    })

    const wordCount = cleanContent.split(/\s+/).length

    // Run automatic SEO check on the generated draft
    const fullContent = `${frontmatter}\n\n${cleanContent}`
    const seoResult = runSEOEvaluation(fullContent, primaryKeyword)

    return {
      success: true,
      title: metaTitle,
      slug,
      filename,
      wordCount,
      provider: result.provider,
      id: articleId,
      seo: {
        score: seoResult.score,
        passFail: seoResult.passFail,
        issueCount: seoResult.checks.filter(c => !c.passed).length,
        topIssues: seoResult.checks.filter(c => !c.passed).slice(0, 3).map(c => c.name)
      }
    }
  })

// Get article details for generation preview
export const getQueueArticleDetails = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    articleId: z.number()
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    return {
      id: article.id,
      title: article.title,
      targetKeywords: article.targetKeywords || [],
      status: article.status,
      notes: article.notes,
      estimatedTraffic: article.estimatedTraffic,
      category: article.category,
      assignedPostSlug: article.assignedPostSlug,
      assignedArticleId: article.assignedArticleId
    }
  })

// Publish a draft from the queue
export const publishFromQueue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number()
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    if (article.status !== 'draft') {
      throw new Error('Only draft articles can be published')
    }

    if (!article.assignedArticleId && !article.assignedPostSlug) {
      throw new Error('No draft file linked to this article')
    }

    // Try to find post by UUID first, fall back to slug
    let postSlug = article.assignedPostSlug
    if (article.assignedArticleId) {
      try {
        const post = await getPostById({ data: { id: article.assignedArticleId } })
        postSlug = post.slug
      } catch {
        // UUID lookup failed, use slug fallback
        if (!postSlug) {
          throw new Error('Could not find linked draft')
        }
      }
    }

    // Publish the post (this will also update queue status via togglePublish)
    const identifier = article.assignedArticleId ?? postSlug!
    const result = await togglePublish({ data: { slug: identifier } })

    return {
      success: true,
      slug: result.slug,
      newStatus: result.newStatus
    }
  })

/**
 * Generate draft with full evaluation and refinement pipeline
 *
 * Pipeline:
 * 1. Generate initial draft (Claude)
 * 2. Quick preflight checks (no AI)
 * 3. Full Judge Swarm evaluation (Gemini - large context for source comparison)
 * 4. If FAIL: Refine with targeted fixes (Claude)
 * 5. Re-evaluate (max 2 refinement attempts)
 * 6. Save final draft with evaluation summary
 */
export const generateDraftWithEvaluation = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number(),
    skipEvaluation: z.boolean().optional().default(false),
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    // Extract research brief from notes for accuracy checking
    const researchBrief = article.notes?.includes('## Research Brief')
      ? article.notes.split('## Research Brief')[1]?.split('---')[0] || ''
      : ''

    // Step 1: Generate initial draft
    console.log(`[Draft] Generating initial draft for: ${article.title}`)

    const draftPrompt = `You are an expert SEO content writer. Write a comprehensive, engaging article.

ABSOLUTELY FORBIDDEN - NEVER DO THESE:
- Do NOT start with "Okay", "Sure", "Here's", or ANY conversational preamble
- Do NOT include phrases like "based on the guidelines" or "SEO-optimized article"
- Do NOT add explanations about what you're doing
- Do NOT use these clichés: "Moreover", "Furthermore", "In conclusion", "It is important to note", "Delve into", "Game-changing", "Unleash", "Digital landscape"
- Do NOT overuse the primary keyword (max 8-12 times in entire article)

Topic: ${article.title}
Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${keywords.slice(1).join(', ')}
${article.instructions ? `\n## CRITICAL INSTRUCTIONS (MUST FOLLOW):\n${article.instructions}\n` : ''}
${article.notes ? `Research & Outline:\n${article.notes}` : ''}

VIRGINIA BEACH SPECIFIC RULES:
- Use "BPOL (Business, Professional, and Occupational License)" instead of generic "business license"
- Reference the ViBe Creative District correctly
- Use accurate local resource URLs

## CRITICAL SEO REQUIREMENTS (MUST FOLLOW EXACTLY):

### 1. Meta Title (50-60 chars)
- MUST contain the exact primary keyword "${primaryKeyword}"

### 2. Meta Description (150-160 chars)
- MUST contain the exact primary keyword "${primaryKeyword}"
- Include a call-to-action

### 3. H1 Title
- MUST contain the exact primary keyword "${primaryKeyword}"

### 4. First Paragraph (within first 100 words)
- MUST contain the exact primary keyword "${primaryKeyword}" naturally

### 5. Keyword Density (CRITICAL - aim for 1-1.5%)
- Use "${primaryKeyword}" only 8-12 times in the entire article
- Use variations and synonyms: "${keywords.slice(1).join('", "')}"

### 6. At Least ONE H2 Must Contain the Primary Keyword

### 7. Links
- Include 2-3 internal links: [related topic](/blog/related-topic)
- Include 1-2 external links to authoritative sources

START YOUR RESPONSE EXACTLY LIKE THIS (first 3 characters must be ---):
---
meta_title: [50-60 chars with primary keyword]
meta_description: [150-160 chars with primary keyword and CTA]
---

# [Title with primary keyword]

[First paragraph with primary keyword in first 100 words...]

Requirements:
1. **Length**: 1800-2500 words (comprehensive but not bloated)
2. **Structure**: Clear H2/H3 hierarchy with logical flow
3. **Paragraphs**: Maximum 3-4 sentences per paragraph
4. **SEO**: Natural keyword integration - use synonyms to avoid stuffing
5. **Engagement**: Uses specific examples and actionable advice
6. **Formatting**: Includes bullets, numbered lists, bold key points
7. **Quick Start**: Include a "Quick Start Checklist" near the top
8. **Links**: Include internal link placeholders and external authoritative links

End with a strong conclusion and call-to-action.`

    const draftResult = await generate({
      prompt: draftPrompt,
      maxTokens: 8192,
      temperature: 0.7
    })

    let content = draftResult.content

    // Strip any preamble before the frontmatter
    const frontmatterStart = content.indexOf('---')
    if (frontmatterStart > 0) {
      content = content.slice(frontmatterStart)
    }

    // Parse AI-generated frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let metaTitle = article.title
    let metaDescription = ''

    if (frontmatterMatch) {
      const fmContent = frontmatterMatch[1]
      const titleMatch = fmContent.match(/meta_title:\s*(.+)/i)
      const descMatch = fmContent.match(/meta_description:\s*(.+)/i)
      metaTitle = titleMatch?.[1]?.trim() ?? article.title
      metaDescription = descMatch?.[1]?.trim() ?? ''
      content = content.slice(frontmatterMatch[0].length).trim()
    }

    // Clean content
    let cleanContent = content
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/—/g, '-')
      .replace(/–/g, '-')

    let finalContent = cleanContent
    let evaluation: EvaluationResult | null = null
    let refinementAttempts = 0

    // Step 2-5: Evaluation and refinement loop (unless skipped)
    if (!data.skipEvaluation) {
      // Quick preflight check
      const preflight = quickPreflightCheck(cleanContent, primaryKeyword)
      console.log(`[Preflight] Issues found: ${preflight.issues.length}`)

      if (preflight.shouldProceed) {
        // Full evaluation with Judge Swarm
        console.log(`[Evaluate] Running Judge Swarm evaluation...`)

        try {
          evaluation = await evaluateArticle({
            data: {
              draft: cleanContent,
              sourceMaterials: researchBrief,
              primaryKeyword,
            }
          })

          console.log(`[Evaluate] Result: ${evaluation.passFail} (Score: ${evaluation.overallScore}/10)`)

          // Refinement loop if failed
          while (evaluation.passFail === 'FAIL' && refinementAttempts < MAX_REFINEMENT_ATTEMPTS) {
            refinementAttempts++
            console.log(`[Refine] Attempt ${refinementAttempts}/${MAX_REFINEMENT_ATTEMPTS}...`)

            const refinementResult = await refineArticle({
              data: {
                draft: finalContent,
                evaluation: {
                  hallucinations: evaluation.hallucinations,
                  clichesFound: evaluation.clichesFound,
                  localIssues: evaluation.localIssues,
                  grammarFixes: evaluation.grammarFixes,
                  readabilityIssues: evaluation.readabilityIssues,
                  seoMissing: evaluation.seoMissing,
                }
              }
            })

            finalContent = refinementResult.content
            console.log(`[Refine] Applied: ${refinementResult.changesApplied.join(', ')}`)

            // Re-evaluate
            evaluation = await evaluateArticle({
              data: {
                draft: finalContent,
                sourceMaterials: researchBrief,
                primaryKeyword,
              }
            })

            console.log(`[Re-evaluate] Result: ${evaluation.passFail} (Score: ${evaluation.overallScore}/10)`)
          }
        } catch (evalError) {
          console.warn('[Evaluate] Evaluation failed, proceeding with draft:', evalError)
        }
      } else {
        console.log(`[Preflight] Too many issues, skipping full evaluation. Issues: ${preflight.issues.join('; ')}`)
      }
    }

    // Step 6: Save the draft
    const { slug: generatedSlug, urlSlug } = buildSeoSlugParts(
      primaryKeyword,
      metaTitle,
      keywords.slice(1)
    )
    const slug = generatedSlug || metaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 75)
    const date = new Date().toISOString().split('T')[0]
    const filename = `${slug}-${date}.md`
    const filePath = path.join(DRAFTS_DIR, filename)

    // Generate a UUID for this article
    const articleId = randomUUID()

    if (!fs.existsSync(DRAFTS_DIR)) {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true })
    }

    // Build frontmatter with evaluation summary if available
    let evaluationNote = ''
    if (evaluation) {
      evaluationNote = `\n# Evaluation: ${evaluation.passFail} (${evaluation.overallScore}/10)`
      if (evaluation.failReasons.length > 0) {
        evaluationNote += `\n# Issues: ${evaluation.failReasons.join(', ')}`
      }
    }

    const frontmatter = `---
article_id: ${articleId}
meta_title: ${metaTitle}
meta_description: ${metaDescription || `Complete guide to ${primaryKeyword}`}
primary_keyword: ${primaryKeyword}
secondary_keywords: ${keywords.slice(1).join(', ')}
url_slug: ${urlSlug || `/blog/${slug}`}
published_date: ${date}
queue_article_id: ${article.id}${evaluationNote}
---`

    // Strip any accidental frontmatter from finalContent
    let bodyContent = finalContent
    if (bodyContent.startsWith('---')) {
      const endMatch = bodyContent.match(/^---[\s\S]*?---\n?/)
      if (endMatch) {
        bodyContent = bodyContent.slice(endMatch[0].length).trim()
      }
    }

    fs.writeFileSync(filePath, `${frontmatter}\n\n${bodyContent}`, 'utf-8')

    // Update queue item (both slug and UUID for compatibility)
    updateQueueItem(data.articleId, {
      status: 'draft',
      assignedPostSlug: slug,
      assignedArticleId: articleId
    })

    const wordCount = bodyContent.split(/\s+/).length

    return {
      success: true,
      title: metaTitle,
      slug,
      filename,
      wordCount,
      provider: draftResult.provider,
      id: articleId,
      evaluation: evaluation ? {
        passFail: evaluation.passFail,
        overallScore: evaluation.overallScore,
        refinementAttempts,
        summary: formatEvaluationSummary(evaluation)
      } : null
    }
  })

/**
 * Evaluate an existing draft file
 */
export const evaluateExistingDraft = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number(),
  }))
  .handler(async ({ data }) => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    if (!article.assignedPostSlug) {
      throw new Error('No draft file linked to this article')
    }

    // Find and read the draft file
    const files = fs.readdirSync(DRAFTS_DIR)
    const draftFile = files.find(f => f.includes(article.assignedPostSlug!))

    if (!draftFile) {
      throw new Error('Draft file not found')
    }

    const draftPath = path.join(DRAFTS_DIR, draftFile)
    const draftContent = fs.readFileSync(draftPath, 'utf-8')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    // Extract research brief for accuracy comparison
    const researchBrief = article.notes?.includes('## Research Brief')
      ? article.notes.split('## Research Brief')[1]?.split('---')[0] || ''
      : ''

    // Run SEO check (fast, deterministic)
    const seoResult = runSEOEvaluation(draftContent, primaryKeyword)

    // Run content evaluation (AI-powered)
    const evaluation = await evaluateArticle({
      data: {
        draft: draftContent,
        sourceMaterials: researchBrief,
        primaryKeyword,
      }
    })

    // Combine SEO score into overall evaluation
    // If SEO fails, it can downgrade the overall result
    const combinedPassFail = evaluation.passFail === 'PASS' && seoResult.passFail === 'PASS'
      ? 'PASS' as const
      : 'FAIL' as const

    // Add SEO failures to fail reasons if SEO failed
    const combinedFailReasons = [...evaluation.failReasons]
    if (seoResult.passFail === 'FAIL') {
      const failedSeoChecks = seoResult.checks.filter(c => !c.passed).slice(0, 3)
      combinedFailReasons.push(`SEO Score ${seoResult.score}/100: ${failedSeoChecks.map(c => c.name).join(', ')}`)
    }

    return {
      success: true,
      evaluation: {
        ...evaluation,
        passFail: combinedPassFail,
        failReasons: combinedFailReasons,
      },
      seo: seoResult,
      summary: formatEvaluationSummary(evaluation) + `\n\n## SEO Check\n${seoResult.summary}`
    }
  })

/**
 * Quick SEO check for an existing draft file
 * Fast, deterministic checks - no AI required
 */
export const checkSEOFromQueue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    articleId: z.number(),
  }))
  .handler(async ({ data }): Promise<{ success: boolean; seo: SEOEvaluationResult }> => {
    const article = getQueueItemById(data.articleId)
    if (!article) throw new Error('Article not found')

    if (!article.assignedPostSlug && !article.assignedArticleId) {
      throw new Error('No draft file linked to this article')
    }

    // Find the draft file - try by article ID first, then slug
    const files = fs.readdirSync(DRAFTS_DIR)
    let draftFile: string | undefined

    if (article.assignedArticleId) {
      // Search for file containing the article ID in frontmatter
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
    const draftContent = fs.readFileSync(draftPath, 'utf-8')

    const keywords = article.targetKeywords || []
    const primaryKeyword = keywords[0] || article.title

    // Run SEO evaluation (fast, deterministic)
    const seo = runSEOEvaluation(draftContent, primaryKeyword)

    return {
      success: true,
      seo
    }
  })
