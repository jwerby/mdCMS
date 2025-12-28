import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getStrikingDistanceKeywords,
  getLowCTRKeywords,
  getDecliningKeywords,
  getKeywordStats,
  getOpportunitySummary as getDbOpportunitySummary,
  calculatePriorityScore,
  type GSCKeyword
} from '../../../lib/seo-planner.server'

// Schema for pagination/filtering
const OpportunityQuerySchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  minImpressions: z.number().min(0).default(100)
})

export type OpportunityQuery = z.infer<typeof OpportunityQuerySchema>

// Enrich keyword with priority score
function enrichWithPriority(keyword: GSCKeyword) {
  return {
    ...keyword,
    priorityScore: calculatePriorityScore(keyword)
  }
}

// Get striking distance keywords (positions 11-30)
export const getStrikingDistanceOpportunities = createServerFn({ method: 'POST' })
  .inputValidator(OpportunityQuerySchema)
  .handler(async ({ data }) => {
    const keywords = getStrikingDistanceKeywords({
      limit: data.limit,
      minImpressions: data.minImpressions
    })

    return keywords.map(enrichWithPriority).sort((a, b) => b.priorityScore - a.priorityScore)
  })

// Get low CTR opportunities (high impressions, low clicks)
export const getLowCTROpportunities = createServerFn({ method: 'POST' })
  .inputValidator(OpportunityQuerySchema.extend({
    maxCtr: z.number().min(0).max(1).default(0.02)
  }))
  .handler(async ({ data }) => {
    const keywords = getLowCTRKeywords({
      limit: data.limit,
      minImpressions: data.minImpressions,
      maxCTR: data.maxCtr
    })

    return keywords.map(enrichWithPriority).sort((a, b) => b.priorityScore - a.priorityScore)
  })

// Get declining keywords (position dropped)
export const getDecliningOpportunities = createServerFn({ method: 'POST' })
  .inputValidator(OpportunityQuerySchema.extend({
    minDrop: z.number().min(0).default(3)
  }))
  .handler(async ({ data }) => {
    const keywords = getDecliningKeywords({
      limit: data.limit,
      minPositionDrop: data.minDrop
    })

    // Calculate priority with position drop factor
    return keywords.map(kw => ({
      ...kw,
      positionDrop: kw.positionChange,
      priorityScore: calculatePriorityScore(kw) * (1 + kw.positionChange / 10)
    })).sort((a, b) => b.priorityScore - a.priorityScore)
  })

// Get opportunity summary stats
export const getOpportunitySummary = createServerFn({ method: 'GET' })
  .handler(async () => {
    const stats = getKeywordStats()
    const opportunities = getDbOpportunitySummary()

    // Get actual keyword lists for top keywords display
    const strikingDistance = getStrikingDistanceKeywords({ limit: 5, minImpressions: 10 })
    const lowCtr = getLowCTRKeywords({ limit: 5, minImpressions: 100, maxCTR: 0.02 })
    const declining = getDecliningKeywords({ limit: 5, minPositionDrop: 3 })

    return {
      totalKeywords: stats.totalKeywords,
      totalImpressions: stats.totalImpressions,
      totalClicks: stats.totalClicks,
      avgPosition: stats.avgPosition,
      avgCtr: stats.avgCtr,
      opportunities: {
        strikingDistance: {
          count: opportunities.strikingDistance,
          trafficPotential: opportunities.totalPotentialTraffic,
          topKeywords: strikingDistance.map(k => k.keyword)
        },
        lowCtr: {
          count: opportunities.lowCTR,
          trafficPotential: Math.round(opportunities.lowCTR * 10), // Rough estimate
          topKeywords: lowCtr.map(k => k.keyword)
        },
        declining: {
          count: opportunities.declining,
          topKeywords: declining.map(k => k.keyword)
        }
      }
    }
  })

// Get all opportunities combined and ranked
export const getAllOpportunities = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    limit: z.number().min(1).max(200).default(100)
  }))
  .handler(async ({ data }) => {
    const [strikingDistance, lowCtr, declining] = await Promise.all([
      getStrikingDistanceOpportunities({ data: { limit: 50, minImpressions: 50 } }),
      getLowCTROpportunities({ data: { limit: 50, minImpressions: 100, maxCtr: 0.02 } }),
      getDecliningOpportunities({ data: { limit: 50, minImpressions: 50, minDrop: 3 } })
    ])

    // Combine and dedupe by keyword
    const seen = new Set<string>()
    const combined: Array<{
      keyword: string
      pageUrl: string | null
      impressions: number
      clicks: number
      ctr: number
      position: number
      priorityScore: number
      opportunityType: 'striking_distance' | 'low_ctr' | 'declining'
    }> = []

    for (const kw of strikingDistance) {
      if (!seen.has(kw.keyword)) {
        seen.add(kw.keyword)
        combined.push({ ...kw, opportunityType: 'striking_distance' })
      }
    }

    for (const kw of lowCtr) {
      if (!seen.has(kw.keyword)) {
        seen.add(kw.keyword)
        combined.push({ ...kw, opportunityType: 'low_ctr' })
      }
    }

    for (const kw of declining) {
      if (!seen.has(kw.keyword)) {
        seen.add(kw.keyword)
        combined.push({ ...kw, opportunityType: 'declining' })
      }
    }

    // Sort by priority and return top results
    return combined
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, data.limit)
  })
