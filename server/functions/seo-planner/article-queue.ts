import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createQueueItem,
  getQueueItems,
  getQueueItemById,
  updateQueueItem,
  deleteQueueItem,
  getQueueStats,
  type ArticleQueueItem,
  type QueueStatus
} from '../../../lib/seo-planner.server'

// Zod schemas
const QueueItemCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  targetKeywords: z.array(z.string()).min(1, 'At least one keyword is required'),
  category: z.string().optional(),
  notes: z.string().optional(),
  sourceKeywordId: z.number().optional(),
  estimatedTraffic: z.number().optional()
})

const QueueItemUpdateSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  targetKeywords: z.array(z.string()).optional(),
  status: z.enum(['idea', 'research', 'outline', 'draft', 'published']).optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
  assignedPostSlug: z.string().optional()
})

const QueueFilterSchema = z.object({
  status: z.enum(['idea', 'research', 'outline', 'draft', 'published', 'all']).optional(),
  category: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
})

// Create a new queue item
export const createArticle = createServerFn({ method: 'POST' })
  .inputValidator(QueueItemCreateSchema)
  .handler(async ({ data }) => {
    const item = createQueueItem({
      title: data.title,
      targetKeywords: data.targetKeywords,
      category: data.category,
      notes: data.notes,
      sourceKeywordId: data.sourceKeywordId,
      estimatedTraffic: data.estimatedTraffic
    })

    return { id: item.id, success: true }
  })

// Get queue items with filters
export const getArticles = createServerFn({ method: 'POST' })
  .inputValidator(QueueFilterSchema)
  .handler(async ({ data }) => {
    const result = getQueueItems({
      status: data.status === 'all' ? undefined : data.status,
      category: data.category,
      limit: data.limit,
      offset: data.offset
    })

    return result.items
  })

// Get a single queue item
export const getArticle = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const item = getQueueItemById(data.id)

    if (!item) {
      throw new Error('Article not found')
    }

    return item
  })

// Update a queue item
export const updateArticle = createServerFn({ method: 'POST' })
  .inputValidator(QueueItemUpdateSchema)
  .handler(async ({ data }) => {
    const { id, ...updates } = data

    updateQueueItem(id, updates)

    return { success: true }
  })

// Move item to a different status
export const moveArticle = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.number(),
    status: z.enum(['idea', 'research', 'outline', 'draft', 'published'])
  }))
  .handler(async ({ data }) => {
    updateQueueItem(data.id, { status: data.status })
    return { success: true }
  })

// Delete a queue item
export const removeArticle = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    deleteQueueItem(data.id)
    return { success: true }
  })

// Bulk add from opportunities
export const bulkAddFromOpportunities = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    opportunities: z.array(z.object({
      keyword: z.string(),
      priorityScore: z.number(),
      estimatedTraffic: z.number().optional()
    })),
    category: z.string().optional()
  }))
  .handler(async ({ data }) => {
    const created: number[] = []

    for (const opp of data.opportunities) {
      const item = createQueueItem({
        title: `Article: ${opp.keyword}`,
        targetKeywords: [opp.keyword],
        category: data.category,
        notes: 'Auto-generated from SEO opportunity',
        estimatedTraffic: opp.estimatedTraffic
      })
      created.push(item.id)
    }

    return { success: true, created }
  })

// Get queue statistics
export const getQueueStatistics = createServerFn({ method: 'GET' })
  .handler(async () => {
    const stats = getQueueStats()

    return {
      total: stats.total,
      byStatus: stats.byStatus
    }
  })

// Get items grouped by status (for Kanban view)
export const getKanbanData = createServerFn({ method: 'GET' })
  .handler(async () => {
    const statuses: QueueStatus[] = ['idea', 'research', 'outline', 'draft', 'published']

    const columns: Record<QueueStatus, ArticleQueueItem[]> = {
      idea: [],
      research: [],
      outline: [],
      draft: [],
      published: []
    }

    for (const status of statuses) {
      const result = getQueueItems({ status, limit: 50 })
      columns[status] = result.items
    }

    return columns
  })
