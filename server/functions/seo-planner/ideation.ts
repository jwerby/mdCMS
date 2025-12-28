import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generate } from '../ai/index'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { getPosts } from '../posts'
import { getQueueItems } from '../../../lib/seo-planner.server'

// Schema for ideation input
const IdeationInputSchema = z.object({
  niche: z.string().min(3, 'Niche must be at least 3 characters'),
  businessDescription: z.string().optional(),
  targetAudience: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  existingTopics: z.array(z.string()).optional(),
  count: z.number().min(5).max(30).default(15)
})

export type IdeationInput = z.infer<typeof IdeationInputSchema>

// Output structure for a keyword idea
export interface KeywordIdea {
  keyword: string
  articleTitle: string
  searchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial'
  estimatedVolume: 'high' | 'medium' | 'low'
  estimatedDifficulty: 'easy' | 'medium' | 'hard'
  trafficPotential: number // 1-100 score
  rationale: string
  relatedKeywords: string[]
  contentType: 'guide' | 'listicle' | 'how-to' | 'comparison' | 'review' | 'explainer'
}

export interface IdeationOutput {
  niche: string
  ideas: KeywordIdea[]
  summary: string
  provider: 'gemini' | 'anthropic'
}

const IDEATION_SYSTEM_PROMPT = `You are an expert SEO strategist and keyword researcher. Your job is to identify high-value keyword opportunities for websites that are just starting out or have low organic traffic.

Focus on:
1. Long-tail keywords with lower competition but decent search volume
2. Keywords that match user intent and can drive conversions
3. Topics that establish topical authority in the niche
4. Content gaps that competitors may have missed
5. Question-based keywords (how to, what is, why, etc.)

Always consider:
- Search intent (informational, transactional, commercial, navigational)
- Competition level (favor easier wins for new sites)
- Content type that would best serve the keyword
- Related/supporting keywords to build topic clusters`

// Generate keyword ideas for a niche
export const generateKeywordIdeas = createServerFn({ method: 'POST' })
  .inputValidator(IdeationInputSchema)
  .handler(async ({ data }) => {
    // Rate limiting
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    const prompt = `Generate ${data.count} high-value keyword ideas for a website in the "${data.niche}" niche.

${data.businessDescription ? `Business Description: ${data.businessDescription}` : ''}
${data.targetAudience ? `Target Audience: ${data.targetAudience}` : ''}
${data.competitors?.length ? `Competitors to differentiate from: ${data.competitors.join(', ')}` : ''}
${data.existingTopics?.length ? `Already covered topics (avoid these): ${data.existingTopics.join(', ')}` : ''}

For each keyword idea, provide:
1. The primary keyword to target
2. A compelling article title
3. Search intent (informational/transactional/navigational/commercial)
4. Estimated search volume (high/medium/low)
5. Estimated ranking difficulty (easy/medium/hard)
6. Traffic potential score (1-100)
7. Brief rationale for why this is a good opportunity
8. 3-5 related keywords to include
9. Best content type (guide/listicle/how-to/comparison/review/explainer)

Prioritize:
- "Easy wins" - lower difficulty keywords that a new site can rank for
- Keywords with clear commercial or lead-gen potential
- Topics that build topical authority

Return your response as valid JSON in this exact format:
{
  "summary": "Brief overview of the keyword strategy",
  "ideas": [
    {
      "keyword": "primary keyword",
      "articleTitle": "Compelling Article Title",
      "searchIntent": "informational",
      "estimatedVolume": "medium",
      "estimatedDifficulty": "easy",
      "trafficPotential": 75,
      "rationale": "Why this is a good opportunity",
      "relatedKeywords": ["related1", "related2", "related3"],
      "contentType": "how-to"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or additional text.`

    const result = await generate({
      prompt,
      systemPrompt: IDEATION_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.8 // Slightly higher for creative ideas
    })

    // Parse the JSON response
    let parsed: { summary: string; ideas: KeywordIdea[] }
    try {
      // Remove any markdown code blocks if present
      let cleanContent = result.content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7)
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3)
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3)
      }
      parsed = JSON.parse(cleanContent.trim())
    } catch (parseError) {
      console.error('Failed to parse AI response:', result.content)
      throw new Error('Failed to parse keyword ideas. Please try again.')
    }

    // Validate and clean up the ideas
    const validatedIdeas: KeywordIdea[] = parsed.ideas.map(idea => ({
      keyword: idea.keyword || '',
      articleTitle: idea.articleTitle || idea.keyword,
      searchIntent: (['informational', 'transactional', 'navigational', 'commercial'].includes(idea.searchIntent)
        ? idea.searchIntent
        : 'informational') as KeywordIdea['searchIntent'],
      estimatedVolume: (['high', 'medium', 'low'].includes(idea.estimatedVolume)
        ? idea.estimatedVolume
        : 'medium') as KeywordIdea['estimatedVolume'],
      estimatedDifficulty: (['easy', 'medium', 'hard'].includes(idea.estimatedDifficulty)
        ? idea.estimatedDifficulty
        : 'medium') as KeywordIdea['estimatedDifficulty'],
      trafficPotential: Math.max(1, Math.min(100, idea.trafficPotential || 50)),
      rationale: idea.rationale || '',
      relatedKeywords: Array.isArray(idea.relatedKeywords) ? idea.relatedKeywords : [],
      contentType: (['guide', 'listicle', 'how-to', 'comparison', 'review', 'explainer'].includes(idea.contentType)
        ? idea.contentType
        : 'guide') as KeywordIdea['contentType']
    })).filter(idea => idea.keyword.length > 0)

    // Sort by traffic potential (best opportunities first)
    validatedIdeas.sort((a, b) => {
      // Prioritize easy difficulty, then by traffic potential
      const difficultyScore = { easy: 3, medium: 2, hard: 1 }
      const aScore = (difficultyScore[a.estimatedDifficulty] * 30) + a.trafficPotential
      const bScore = (difficultyScore[b.estimatedDifficulty] * 30) + b.trafficPotential
      return bScore - aScore
    })

    return {
      niche: data.niche,
      ideas: validatedIdeas,
      summary: parsed.summary || `Generated ${validatedIdeas.length} keyword ideas for ${data.niche}`,
      provider: result.provider
    } as IdeationOutput
  })

// Quick ideation with just a niche
export const quickIdeate = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    niche: z.string().min(3)
  }))
  .handler(async ({ data }) => {
    return generateKeywordIdeas({
      data: {
        niche: data.niche,
        count: 10
      }
    })
  })

// Get content cluster suggestions based on a primary topic
export const generateContentCluster = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    pillarTopic: z.string().min(3, 'Topic must be at least 3 characters'),
    niche: z.string().optional(),
    depth: z.enum(['shallow', 'medium', 'deep']).default('medium')
  }))
  .handler(async ({ data }) => {
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    const clusterSize = data.depth === 'shallow' ? 5 : data.depth === 'medium' ? 10 : 15

    const prompt = `Create a content cluster strategy for the pillar topic: "${data.pillarTopic}"
${data.niche ? `Niche: ${data.niche}` : ''}

Generate a hub-and-spoke content cluster with:
1. A pillar page concept (comprehensive guide)
2. ${clusterSize} supporting cluster articles that link to/from the pillar

For each piece of content, provide:
- Keyword target
- Article title
- Content type
- How it supports the pillar topic
- Internal linking strategy

Return as JSON:
{
  "pillarPage": {
    "keyword": "main keyword",
    "title": "Ultimate Guide Title",
    "outline": ["section1", "section2", "section3"],
    "wordCountTarget": 3000
  },
  "clusterArticles": [
    {
      "keyword": "supporting keyword",
      "title": "Article Title",
      "contentType": "how-to",
      "linksToPillar": "how this supports the pillar",
      "trafficPotential": 70
    }
  ],
  "interlinkingStrategy": "Brief description of how to link these together"
}

IMPORTANT: Return ONLY valid JSON.`

    const result = await generate({
      prompt,
      systemPrompt: IDEATION_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.7
    })

    // Parse JSON response
    let parsed
    try {
      let cleanContent = result.content.trim()
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7)
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3)
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3)
      parsed = JSON.parse(cleanContent.trim())
    } catch {
      throw new Error('Failed to parse content cluster. Please try again.')
    }

    return {
      ...parsed,
      provider: result.provider
    }
  })

// Content Gap Analysis types
export interface ContentGapAnalysis {
  existingContent: {
    published: number
    drafts: number
    queued: number
    topics: string[]
  }
  gaps: ContentGap[]
  recommendations: KeywordIdea[]
  summary: string
  provider: 'gemini' | 'anthropic'
}

export interface ContentGap {
  topic: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  suggestedKeywords: string[]
}

// Analyze existing content and find gaps
export const analyzeContentGaps = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    niche: z.string().min(3, 'Niche must be at least 3 characters'),
    businessDescription: z.string().optional(),
    targetAudience: z.string().optional(),
    count: z.number().min(5).max(20).default(10)
  }))
  .handler(async ({ data }) => {
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    // Fetch existing posts
    const posts = await getPosts()
    const publishedPosts = posts.filter(p => p.directory === 'published')
    const draftPosts = posts.filter(p => p.directory === 'drafts')

    // Fetch queued articles
    const queueResult = getQueueItems({ limit: 100 })
    const queuedArticles = queueResult.items

    // Extract topics from existing content
    const existingTopics: string[] = []

    // From published/draft posts
    posts.forEach(post => {
      // Add title
      if (post.title) existingTopics.push(post.title)
      // Add primary keyword from frontmatter
      const primaryKeyword = post.frontmatter?.primary_keyword || post.frontmatter?.['Primary Keyword']
      if (primaryKeyword) existingTopics.push(primaryKeyword)
      // Add secondary keywords
      const secondaryKeywords = post.frontmatter?.secondary_keywords
      if (Array.isArray(secondaryKeywords)) {
        existingTopics.push(...secondaryKeywords)
      } else if (typeof secondaryKeywords === 'string') {
        existingTopics.push(secondaryKeywords)
      }
    })

    // From queued articles
    queuedArticles.forEach(item => {
      if (item.title) existingTopics.push(item.title)
      if (item.targetKeywords) {
        try {
          const keywords = JSON.parse(item.targetKeywords)
          if (Array.isArray(keywords)) existingTopics.push(...keywords)
        } catch {
          // targetKeywords might be a plain string
          existingTopics.push(item.targetKeywords)
        }
      }
    })

    // Deduplicate and clean topics
    const uniqueTopics = [...new Set(existingTopics.filter(t => t && t.length > 2))]

    const prompt = `Analyze the following existing content and identify content gaps for a website in the "${data.niche}" niche.

${data.businessDescription ? `Business Description: ${data.businessDescription}` : ''}
${data.targetAudience ? `Target Audience: ${data.targetAudience}` : ''}

EXISTING CONTENT (${uniqueTopics.length} topics already covered):
${uniqueTopics.slice(0, 50).map((t, i) => `${i + 1}. ${t}`).join('\n')}
${uniqueTopics.length > 50 ? `\n... and ${uniqueTopics.length - 50} more topics` : ''}

Based on this existing content:
1. Identify ${data.count} content gaps - topics that should be covered but aren't
2. For each gap, explain WHY it's missing and its priority
3. Generate specific keyword ideas to fill these gaps

Focus on:
- Topics that would complement existing content
- Missing foundational/101 content
- Missing advanced/deep-dive content
- Missing comparison or alternatives content
- Missing how-to or tutorial content
- Topics that would strengthen topical authority

Return as JSON:
{
  "summary": "Brief analysis of the content strategy and main gaps",
  "gaps": [
    {
      "topic": "The missing topic area",
      "reason": "Why this gap matters",
      "priority": "high",
      "suggestedKeywords": ["keyword1", "keyword2"]
    }
  ],
  "recommendations": [
    {
      "keyword": "primary keyword to target",
      "articleTitle": "Compelling Article Title",
      "searchIntent": "informational",
      "estimatedVolume": "medium",
      "estimatedDifficulty": "easy",
      "trafficPotential": 75,
      "rationale": "How this fills the gap and complements existing content",
      "relatedKeywords": ["related1", "related2"],
      "contentType": "how-to"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks.`

    const result = await generate({
      prompt,
      systemPrompt: IDEATION_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.7
    })

    // Parse the JSON response
    let parsed: { summary: string; gaps: ContentGap[]; recommendations: KeywordIdea[] }
    try {
      let cleanContent = result.content.trim()
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7)
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3)
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3)
      parsed = JSON.parse(cleanContent.trim())
    } catch {
      console.error('Failed to parse AI response:', result.content)
      throw new Error('Failed to analyze content gaps. Please try again.')
    }

    // Validate recommendations
    const validatedRecommendations: KeywordIdea[] = (parsed.recommendations || []).map(idea => ({
      keyword: idea.keyword || '',
      articleTitle: idea.articleTitle || idea.keyword,
      searchIntent: (['informational', 'transactional', 'navigational', 'commercial'].includes(idea.searchIntent)
        ? idea.searchIntent
        : 'informational') as KeywordIdea['searchIntent'],
      estimatedVolume: (['high', 'medium', 'low'].includes(idea.estimatedVolume)
        ? idea.estimatedVolume
        : 'medium') as KeywordIdea['estimatedVolume'],
      estimatedDifficulty: (['easy', 'medium', 'hard'].includes(idea.estimatedDifficulty)
        ? idea.estimatedDifficulty
        : 'medium') as KeywordIdea['estimatedDifficulty'],
      trafficPotential: Math.max(1, Math.min(100, idea.trafficPotential || 50)),
      rationale: idea.rationale || '',
      relatedKeywords: Array.isArray(idea.relatedKeywords) ? idea.relatedKeywords : [],
      contentType: (['guide', 'listicle', 'how-to', 'comparison', 'review', 'explainer'].includes(idea.contentType)
        ? idea.contentType
        : 'guide') as KeywordIdea['contentType']
    })).filter(idea => idea.keyword.length > 0)

    // Validate gaps
    const validatedGaps: ContentGap[] = (parsed.gaps || []).map(gap => ({
      topic: gap.topic || '',
      reason: gap.reason || '',
      priority: (['high', 'medium', 'low'].includes(gap.priority) ? gap.priority : 'medium') as ContentGap['priority'],
      suggestedKeywords: Array.isArray(gap.suggestedKeywords) ? gap.suggestedKeywords : []
    })).filter(gap => gap.topic.length > 0)

    return {
      existingContent: {
        published: publishedPosts.length,
        drafts: draftPosts.length,
        queued: queuedArticles.length,
        topics: uniqueTopics.slice(0, 20) // Return top 20 for UI display
      },
      gaps: validatedGaps,
      recommendations: validatedRecommendations,
      summary: parsed.summary || `Analyzed ${uniqueTopics.length} existing topics and found ${validatedGaps.length} content gaps`,
      provider: result.provider
    } as ContentGapAnalysis
  })

// Get existing content summary without AI analysis
export const getExistingContentSummary = createServerFn({ method: 'GET' })
  .handler(async () => {
    const posts = await getPosts()
    const publishedPosts = posts.filter(p => p.directory === 'published')
    const draftPosts = posts.filter(p => p.directory === 'drafts')
    const queueResult = getQueueItems({ limit: 100 })

    // Extract all topics/keywords
    const topics: string[] = []
    posts.forEach(post => {
      if (post.title) topics.push(post.title)
      const pk = post.frontmatter?.primary_keyword || post.frontmatter?.['Primary Keyword']
      if (pk) topics.push(pk)
    })

    queueResult.items.forEach(item => {
      if (item.title) topics.push(item.title)
    })

    return {
      published: publishedPosts.length,
      drafts: draftPosts.length,
      queued: queueResult.items.length,
      totalTopics: [...new Set(topics)].length,
      sampleTopics: [...new Set(topics)].slice(0, 10)
    }
  })
