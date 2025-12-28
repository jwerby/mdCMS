import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import {
  bulkUpsertKeywords,
  createSyncEntry,
  updateSyncEntry,
  getSyncHistory as getDbSyncHistory,
  getLastSuccessfulSync,
  getRunningSync,
  getCredentials
} from '../../../lib/seo-planner.server'
import { getKeywordsByPage, getDateRange } from './client'

const CREDENTIALS_PATH = path.join(process.cwd(), 'content', 'credentials', 'google-credentials.json')

const SyncOptionsSchema = z.object({
  type: z.enum(['full', 'incremental']).default('incremental'),
  days: z.number().min(1).max(365).default(28)
})

export type SyncOptions = z.infer<typeof SyncOptionsSchema>

// Start a sync with GSC
export const syncGSCData = createServerFn({ method: 'POST' })
  .inputValidator(SyncOptionsSchema)
  .handler(async ({ data }) => {
    const credentials = getCredentials()
    const hasCredentialsFile = fs.existsSync(CREDENTIALS_PATH)

    if (!hasCredentialsFile || !credentials?.siteUrl) {
      throw new Error('Not connected to Google Search Console. Please connect in settings.')
    }

    const { startDate, endDate } = getDateRange(data.days)

    // Start sync record
    const syncId = createSyncEntry({
      syncType: data.type,
      dateRangeStart: startDate,
      dateRangeEnd: endDate
    })

    try {
      // Fetch keyword data from GSC
      const keywords = await getKeywordsByPage({
        data: {
          startDate,
          endDate,
          rowLimit: 10000 // Fetch up to 10k keywords
        }
      })

      if (keywords.length === 0) {
        updateSyncEntry(syncId.id, { status: 'completed', recordsFetched: 0 })
        return {
          success: true,
          recordsFetched: 0,
          message: 'No keyword data found for the selected date range'
        }
      }

      // Transform and save keywords
      const keywordRecords = keywords.map(kw => ({
        keyword: kw.keyword,
        pageUrl: kw.pageUrl,
        impressions: kw.impressions,
        clicks: kw.clicks,
        ctr: kw.ctr,
        position: kw.position,
        date: endDate // Use end date as the snapshot date
      }))

      bulkUpsertKeywords(keywordRecords)
      updateSyncEntry(syncId.id, { status: 'completed', recordsFetched: keywords.length })

      return {
        success: true,
        recordsFetched: keywords.length,
        dateRange: { startDate, endDate },
        message: `Successfully synced ${keywords.length} keyword records`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateSyncEntry(syncId.id, { status: 'failed', errorMessage })
      throw new Error(`Sync failed: ${errorMessage}`)
    }
  })

// Get sync status
export const getSyncStatus = createServerFn({ method: 'GET' })
  .handler(async () => {
    const credentials = getCredentials()
    const hasCredentialsFile = fs.existsSync(CREDENTIALS_PATH)
    const runningSync = getRunningSync()
    const latestSync = runningSync || getLastSuccessfulSync()

    const isConnected = hasCredentialsFile && !!credentials?.siteUrl

    if (!latestSync) {
      return {
        isConnected,
        hasData: false,
        lastSync: null,
        status: isConnected ? 'ready' : 'not_connected'
      }
    }

    return {
      isConnected,
      hasData: true,
      lastSync: {
        id: latestSync.id,
        type: latestSync.syncType,
        status: latestSync.status,
        recordsFetched: latestSync.recordsFetched,
        dateRange: {
          start: latestSync.dateRangeStart,
          end: latestSync.dateRangeEnd
        },
        startedAt: latestSync.startedAt,
        completedAt: latestSync.completedAt,
        error: latestSync.errorMessage
      },
      status: latestSync.status === 'running' ? 'syncing' : 'ready'
    }
  })

// Get sync history
export const getSyncHistory = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    limit: z.number().min(1).max(100).default(10)
  }).optional())
  .handler(async ({ data }) => {
    const history = getDbSyncHistory(data?.limit || 10)

    return history.map(sync => ({
      id: sync.id,
      type: sync.syncType,
      status: sync.status,
      recordsFetched: sync.recordsFetched,
      dateRange: {
        start: sync.dateRangeStart,
        end: sync.dateRangeEnd
      },
      startedAt: sync.startedAt,
      completedAt: sync.completedAt,
      error: sync.errorMessage
    }))
  })

// Quick sync (last 7 days)
export const quickSync = createServerFn({ method: 'POST' })
  .handler(async () => {
    return syncGSCData({ data: { type: 'incremental', days: 7 } })
  })

// Full sync (last 90 days)
export const fullSync = createServerFn({ method: 'POST' })
  .handler(async () => {
    return syncGSCData({ data: { type: 'full', days: 90 } })
  })
