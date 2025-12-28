import { createServerFn } from '@tanstack/react-start'
import { generate } from './index'
import { PROMPTS } from './prompts'
import fs from 'fs'
import path from 'path'
import { parseFrontmatter } from '../../../lib/markdown/frontmatter-parser'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface PerformanceInput {
  // Optional: pass in analytics data if available
  analyticsData?: {
    pageViews?: Record<string, number>
    avgTimeOnPage?: Record<string, number>
    bounceRate?: Record<string, number>
    impressions?: Record<string, number>
    clicks?: Record<string, number>
    position?: Record<string, number>
  }
}

export interface ContentTask {
  articleId?: string
  slug: string
  title: string
  taskType: 'rewrite' | 'update' | 'optimize' | 'expand' | 'consolidate'
  priority: 'high' | 'medium' | 'low'
  reason: string
  expectedImpact: string
}

export interface PerformanceResult {
  tasks: ContentTask[]
  summary: string
  rawAnalysis: string
  provider: 'gemini' | 'anthropic'
  dataSource: 'analytics' | 'content-only'
}

export const runPerformance = createServerFn({ method: 'POST' })
  .inputValidator((data: PerformanceInput) => data)
  .handler(async ({ data }) => {
    // Read all published content
    const publishedDir = path.join(CONTENT_DIR, 'published')

    if (!fs.existsSync(publishedDir)) {
      return {
        tasks: [],
        summary: 'No published content found to analyze.',
        rawAnalysis: '',
        provider: 'gemini' as const,
        dataSource: 'content-only' as const
      }
    }

    const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.md'))

    if (files.length === 0) {
      return {
        tasks: [],
        summary: 'No published content found to analyze.',
        rawAnalysis: '',
        provider: 'gemini' as const,
        dataSource: 'content-only' as const
      }
    }

    // Build content inventory
    const contentInventory = files.map(file => {
      const filePath = path.join(publishedDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')

      const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(content)

      const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
      const title = String(
        frontmatter.meta_title ??
        frontmatter.title ??
        frontmatter['Meta Title'] ??
        titleFromBody ??
        file
      ).trim()

      const publishedDate = String(
        frontmatter.published_date ?? frontmatter.date ?? frontmatter['Published Date'] ?? 'Unknown'
      ).trim()

      const primaryKeyword = String(
        frontmatter.primary_keyword ?? frontmatter['Primary Keyword'] ?? 'Not set'
      ).trim()

      const slugFromFrontmatter = String(
        frontmatter.url_slug ?? frontmatter['URL Slug'] ?? ''
      ).trim()
      const normalizedSlug = slugFromFrontmatter
        ? slugFromFrontmatter.replace(/^\/blog\//, '').replace(/^\//, '')
        : ''
      const filenameSlug = file.replace('.md', '').replace(/-\d{4}-\d{2}-\d{2}$/, '')
      const slug = normalizedSlug || filenameSlug

      // Count words
      const wordCount = body.split(/\s+/).filter(Boolean).length

      // Get analytics data if available
      const analytics = data.analyticsData ? {
        pageViews: data.analyticsData.pageViews?.[slug] ?? 'N/A',
        avgTimeOnPage: data.analyticsData.avgTimeOnPage?.[slug] ?? 'N/A',
        bounceRate: data.analyticsData.bounceRate?.[slug] ?? 'N/A',
        impressions: data.analyticsData.impressions?.[slug] ?? 'N/A',
        clicks: data.analyticsData.clicks?.[slug] ?? 'N/A',
        position: data.analyticsData.position?.[slug] ?? 'N/A',
      } : null

      const articleId = typeof frontmatter.article_id === 'string' ? frontmatter.article_id.trim() : ''

      return {
        slug,
        articleId,
        title,
        publishedDate,
        primaryKeyword,
        wordCount,
        analytics
      }
    })

    const hasAnalytics = data.analyticsData && Object.keys(data.analyticsData).length > 0

    const prompt = `
${PROMPTS.performance}

Content Inventory:
${contentInventory.map(c => `
## ${c.title}
- Article ID: ${c.articleId || 'unknown'}
- Slug: ${c.slug}
- Published: ${c.publishedDate}
- Primary Keyword: ${c.primaryKeyword}
- Word Count: ${c.wordCount}
${c.analytics ? `- Analytics:
  - Page Views: ${c.analytics.pageViews}
  - Avg Time on Page: ${c.analytics.avgTimeOnPage}
  - Bounce Rate: ${c.analytics.bounceRate}
  - Search Impressions: ${c.analytics.impressions}
  - Search Clicks: ${c.analytics.clicks}
  - Avg Position: ${c.analytics.position}` : '- No analytics data available'}
`).join('\n')}

${hasAnalytics
  ? 'Based on the analytics data, identify underperforming content and quick wins.'
  : 'No analytics data is available. Analyze content based on age, keyword targeting, and content quality indicators.'}

Provide a prioritized task queue in this format:

## Task Queue

For each content piece that needs attention:
- Article ID: [article_id]
- Slug: [slug]
- Title: [title]
- Task Type: rewrite/update/optimize/expand/consolidate
- Priority: high/medium/low
- Reason: [why this needs attention]
- Expected Impact: [what improvement to expect]

## Summary
[Brief overview of the content portfolio health and top priorities]
`

    const result = await generate({
      prompt,
      maxTokens: 4096,
      temperature: 0.5,
    })

    // Parse tasks
    const tasks: ContentTask[] = []
    const taskMatches = result.content.matchAll(/- Article ID:\s*(.*)\n\s*- Slug:\s*(.+)\n\s*- Title:\s*(.+)\n\s*- Task Type:\s*(rewrite|update|optimize|expand|consolidate)\n\s*- Priority:\s*(high|medium|low)\n\s*- Reason:\s*(.+)\n\s*- Expected Impact:\s*(.+)/gi)

    for (const match of taskMatches) {
      const articleId = match[1].trim()
      tasks.push({
        articleId: articleId && articleId.toLowerCase() !== 'unknown' ? articleId : undefined,
        slug: match[2].trim(),
        title: match[3].trim(),
        taskType: match[4].toLowerCase() as ContentTask['taskType'],
        priority: match[5].toLowerCase() as 'high' | 'medium' | 'low',
        reason: match[6].trim(),
        expectedImpact: match[7].trim()
      })
    }

    if (tasks.length === 0) {
      const legacyMatches = result.content.matchAll(/- Slug:\s*(.+)\n\s*- Title:\s*(.+)\n\s*- Task Type:\s*(rewrite|update|optimize|expand|consolidate)\n\s*- Priority:\s*(high|medium|low)\n\s*- Reason:\s*(.+)\n\s*- Expected Impact:\s*(.+)/gi)
      for (const match of legacyMatches) {
        tasks.push({
          slug: match[1].trim(),
          title: match[2].trim(),
          taskType: match[3].toLowerCase() as ContentTask['taskType'],
          priority: match[4].toLowerCase() as 'high' | 'medium' | 'low',
          reason: match[5].trim(),
          expectedImpact: match[6].trim()
        })
      }
    }

    // Extract summary
    const summaryMatch = result.content.match(/## Summary\n([\s\S]*?)(?=\n## |$)/i)
    const summary = summaryMatch?.[1]?.trim() ?? 'Analysis complete.'

    return {
      tasks,
      summary,
      rawAnalysis: result.content,
      provider: result.provider,
      dataSource: hasAnalytics ? 'analytics' : 'content-only'
    }
  })
