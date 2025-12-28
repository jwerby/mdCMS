import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { GoogleAuth } from 'google-auth-library'
import * as fs from 'fs'
import * as path from 'path'
import { getCredentials } from '../../../lib/seo-planner.server'

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'
const CREDENTIALS_PATH = path.join(process.cwd(), 'content', 'credentials', 'google-credentials.json')

// Types for GSC API responses
export interface GSCSearchAnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCSearchAnalyticsResponse {
  rows?: GSCSearchAnalyticsRow[]
  responseAggregationType?: string
}

export interface GSCSiteInfo {
  siteUrl: string
  permissionLevel: string
}

// Cache for the auth client
let authClient: GoogleAuth | null = null

// Get or create the Google Auth client using service account
async function getAuthClient(): Promise<GoogleAuth> {
  if (authClient) {
    return authClient
  }

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google credentials file not found at ${CREDENTIALS_PATH}`)
  }

  authClient = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  })

  return authClient
}

// Get access token from service account
async function getAccessToken(): Promise<string> {
  const auth = await getAuthClient()
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()

  if (!tokenResponse.token) {
    throw new Error('Failed to get access token from service account')
  }

  return tokenResponse.token
}

// Fetch wrapper with auth
async function gscFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken()

  const response = await fetch(`${GSC_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GSC API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<T>
}

// Get list of sites the user has access to
export const getGSCSites = createServerFn({ method: 'GET' })
  .handler(async () => {
    const result = await gscFetch<{ siteEntry?: GSCSiteInfo[] }>('/sites')
    return result.siteEntry || []
  })

// Schema for search analytics query
const SearchAnalyticsQuerySchema = z.object({
  startDate: z.string(), // YYYY-MM-DD format
  endDate: z.string(),
  dimensions: z.array(z.enum(['query', 'page', 'country', 'device', 'date'])).default(['query']),
  rowLimit: z.number().min(1).max(25000).default(1000),
  startRow: z.number().min(0).default(0)
})

export type SearchAnalyticsQuery = z.infer<typeof SearchAnalyticsQuerySchema>

// Query search analytics data
export const querySearchAnalytics = createServerFn({ method: 'POST' })
  .inputValidator(SearchAnalyticsQuerySchema)
  .handler(async ({ data }) => {
    const credentials = getCredentials()

    if (!credentials?.siteUrl) {
      throw new Error('Site URL not configured. Please set it in SEO Planner settings.')
    }

    const siteUrl = encodeURIComponent(credentials.siteUrl)

    const result = await gscFetch<GSCSearchAnalyticsResponse>(
      `/sites/${siteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: data.dimensions,
          rowLimit: data.rowLimit,
          startRow: data.startRow
        })
      }
    )

    return result.rows || []
  })

// Get keyword data with both query and page dimensions
export const getKeywordsByPage = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    startDate: z.string(),
    endDate: z.string(),
    rowLimit: z.number().default(5000)
  }))
  .handler(async ({ data }) => {
    const credentials = getCredentials()

    if (!credentials?.siteUrl) {
      throw new Error('Site URL not configured')
    }

    const siteUrl = encodeURIComponent(credentials.siteUrl)

    const result = await gscFetch<GSCSearchAnalyticsResponse>(
      `/sites/${siteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: ['query', 'page'],
          rowLimit: data.rowLimit
        })
      }
    )

    // Transform to more usable format
    return (result.rows || []).map(row => ({
      keyword: row.keys[0],
      pageUrl: row.keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }))
  })

// Get top keywords only
export const getTopKeywords = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    startDate: z.string(),
    endDate: z.string(),
    rowLimit: z.number().default(1000),
    orderBy: z.enum(['impressions', 'clicks', 'position']).default('impressions')
  }))
  .handler(async ({ data }) => {
    const credentials = getCredentials()

    if (!credentials?.siteUrl) {
      throw new Error('Site URL not configured')
    }

    const siteUrl = encodeURIComponent(credentials.siteUrl)

    const result = await gscFetch<GSCSearchAnalyticsResponse>(
      `/sites/${siteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: ['query'],
          rowLimit: data.rowLimit
        })
      }
    )

    const rows = (result.rows || []).map(row => ({
      keyword: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }))

    // Sort by requested metric
    if (data.orderBy === 'clicks') {
      rows.sort((a, b) => b.clicks - a.clicks)
    } else if (data.orderBy === 'position') {
      rows.sort((a, b) => a.position - b.position)
    } else {
      rows.sort((a, b) => b.impressions - a.impressions)
    }

    return rows
  })

// Test connection by fetching site info
export const testGSCConnection = createServerFn({ method: 'GET' })
  .handler(async () => {
    const credentials = getCredentials()

    if (!credentials?.siteUrl) {
      return {
        success: false,
        error: 'Site URL not configured. Please set it in SEO Planner settings.'
      }
    }

    try {
      // First check if credentials file exists
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        return {
          success: false,
          error: `Google credentials file not found at ${CREDENTIALS_PATH}`
        }
      }

      const sites = await getGSCSites()
      const siteUrl = credentials.siteUrl

      // Check if configured site is in the list (normalize trailing slashes)
      const normalizedSiteUrl = siteUrl.replace(/\/$/, '')
      const matchingSite = sites.find(s => {
        const normalizedGscUrl = s.siteUrl.replace(/\/$/, '')
        return normalizedGscUrl === normalizedSiteUrl ||
               normalizedGscUrl === normalizedSiteUrl + '/' ||
               s.siteUrl === `sc-domain:${normalizedSiteUrl.replace(/^https?:\/\//, '')}`
      })

      if (!matchingSite) {
        return {
          success: false,
          error: `Site ${siteUrl} not found in Search Console. Available sites: ${sites.map(s => s.siteUrl).join(', ')}`,
          availableSites: sites.map(s => s.siteUrl)
        }
      }

      return {
        success: true,
        siteUrl: matchingSite.siteUrl,
        permissionLevel: matchingSite.permissionLevel
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

// Check if credentials file exists
export const checkCredentialsFile = createServerFn({ method: 'GET' })
  .handler(async () => {
    const exists = fs.existsSync(CREDENTIALS_PATH)
    return {
      exists,
      path: CREDENTIALS_PATH
    }
  })

// Helper to get date ranges
export function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1) // Yesterday (GSC data has 2-day delay)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}
