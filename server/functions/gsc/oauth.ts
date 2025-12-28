import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import {
  getCredentials,
  saveSiteUrl
} from '../../../lib/seo-planner.server'

const CREDENTIALS_PATH = path.join(process.cwd(), 'content', 'credentials', 'google-credentials.json')

// Schema for setting site URL
const SiteUrlSchema = z.object({
  siteUrl: z.string().url('Valid site URL is required')
})

// Save site URL for GSC tracking
export const saveSiteUrlConfig = createServerFn({ method: 'POST' })
  .inputValidator(SiteUrlSchema)
  .handler(async ({ data }) => {
    saveSiteUrl(data.siteUrl)
    return { success: true }
  })

// Get current GSC connection status
export const getGSCConnectionStatus = createServerFn({ method: 'GET' })
  .handler(async () => {
    const credentials = getCredentials()
    const hasCredentialsFile = fs.existsSync(CREDENTIALS_PATH)
    const hasSiteUrl = !!credentials?.siteUrl

    // For service account auth, we're "connected" if we have both credentials file and site URL
    const connected = hasCredentialsFile && hasSiteUrl

    if (!connected) {
      return {
        configured: hasSiteUrl,
        connected: false,
        siteUrl: credentials?.siteUrl || null,
        message: !hasCredentialsFile
          ? 'Credentials file missing'
          : 'Site URL not configured'
      }
    }

    return {
      configured: true,
      connected: true,
      siteUrl: credentials.siteUrl,
      message: 'Ready to sync'
    }
  })

// Get stored settings
export const getGSCSettings = createServerFn({ method: 'GET' })
  .handler(async () => {
    const credentials = getCredentials()

    if (!credentials) {
      return null
    }

    return {
      siteUrl: credentials.siteUrl
    }
  })
