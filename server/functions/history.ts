/**
 * Version history management for posts and pages
 * Uses delta storage to minimize disk usage
 * Saves versions on each update, max 10 per file
 */

import { createServerFn } from '@tanstack/react-start'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../lib/security/path-sanitizer'
import {
  getVersionHistoryInputSchema,
  saveVersionInputSchema,
  historyTypeSchema,
  slugSchema,
  validateInput
} from '../../lib/validation/schemas'
import {
  DeltaVersionEntry,
  createDelta,
  reconstructContent,
  convertToDeltaFormat,
  compactHistory
} from '../../lib/history/delta-storage'
import { z } from 'zod'
import { findPostFileByIdentifier } from '../utils/post-file-locator'

const HISTORY_DIR = 'content/.history'
const MAX_VERSIONS = 10
const MAX_CHAIN_LENGTH = 5 // Create new base every 5 versions
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Legacy format for backward compatibility
export interface VersionEntry {
  id: string
  timestamp: number
  content: string
  type: 'post' | 'page'
  slug: string
  summary?: string
}

export interface VersionList {
  versions: Omit<VersionEntry, 'content'>[]
}

// Storage format marker
interface HistoryFile {
  version: 2 // Format version
  useDelta: true
  entries: DeltaVersionEntry[]
}

// Legacy format detection
interface LegacyHistoryFile extends Array<VersionEntry> {}

type StoredHistory = HistoryFile | LegacyHistoryFile

function getContentDirs() {
  const contentDir = path.join(process.cwd(), 'content')
  return {
    contentDir,
    publishedDir: path.join(contentDir, 'published'),
    draftsDir: path.join(contentDir, 'drafts')
  }
}

function isLikelyId(value: string): boolean {
  return UUID_REGEX.test(value) || value.startsWith('legacy-')
}

function resolveLegacySlugForId(id: string): string | null {
  const { draftsDir, publishedDir } = getContentDirs()
  const match = findPostFileByIdentifier(draftsDir, id) || findPostFileByIdentifier(publishedDir, id)
  return match?.slug ?? null
}

function loadHistoryWithFallback(
  type: 'post' | 'page',
  identifier: string
): { entries: DeltaVersionEntry[]; isLegacy: boolean; migrated: boolean } | null {
  const primaryPath = getHistoryPath(type, identifier)
  if (!primaryPath) return null

  const primaryExists = fs.existsSync(primaryPath)
  const primaryHistory = loadHistory(type, identifier)
  if (!primaryHistory) return null

  const shouldCheckLegacy = type === 'post'
    && isLikelyId(identifier)
    && (!primaryExists || primaryHistory.entries.length === 0)

  if (!shouldCheckLegacy) {
    return { ...primaryHistory, migrated: false }
  }

  const legacySlug = resolveLegacySlugForId(identifier)
  if (!legacySlug || legacySlug === identifier) {
    return { ...primaryHistory, migrated: false }
  }

  const legacyPath = getHistoryPath(type, legacySlug)
  if (!legacyPath || !fs.existsSync(legacyPath)) {
    return { ...primaryHistory, migrated: false }
  }

  const legacyHistory = loadHistory(type, legacySlug)
  if (!legacyHistory) {
    return { ...primaryHistory, migrated: false }
  }

  if (legacyHistory.entries.length > 0 && (!primaryExists || primaryHistory.entries.length === 0)) {
    saveHistory(type, identifier, legacyHistory.entries)
  }

  return { ...legacyHistory, migrated: legacyHistory.entries.length > 0 }
}

/**
 * Ensure the history directory exists
 */
function ensureHistoryDir(): void {
  const historyPath = path.join(process.cwd(), HISTORY_DIR)
  if (!fs.existsSync(historyPath)) {
    fs.mkdirSync(historyPath, { recursive: true })
  }
}

/**
 * Get the history file path for a document (with validation)
 */
function getHistoryPath(type: 'post' | 'page', slug: string): string | null {
  // Sanitize the slug
  const sanitized = sanitizeSlug(slug)
  if (!sanitized.isValid) {
    logSecurityEvent('invalid_slug', { slug, error: sanitized.error })
    return null
  }

  const historyPath = path.join(process.cwd(), HISTORY_DIR, `${type}_${sanitized.sanitized}.json`)

  // Verify path is within history directory
  const historyBase = path.join(process.cwd(), HISTORY_DIR)
  if (!isPathWithinBase(historyPath, historyBase)) {
    logSecurityEvent('path_escape_attempt', { historyPath })
    return null
  }

  return historyPath
}

/**
 * Generate a version ID
 */
function generateVersionId(): string {
  return `v${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Extract a summary from content (first heading or first line)
 */
function extractSummary(content: string): string {
  // Try to find first heading
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch?.[1]) {
    return headingMatch[1].slice(0, 100)
  }

  // Strip frontmatter and get first non-empty line
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lines = withoutFrontmatter.split('\n').filter(line => line.trim())
  if (lines[0]) {
    return lines[0].slice(0, 100)
  }

  return 'Untitled version'
}

/**
 * Check if stored data is in legacy format
 */
function isLegacyFormat(data: StoredHistory): data is LegacyHistoryFile {
  return Array.isArray(data) && (data.length === 0 || !('version' in data))
}

/**
 * Load version history for a document (supports both legacy and delta formats)
 */
function loadHistory(type: 'post' | 'page', slug: string): { entries: DeltaVersionEntry[]; isLegacy: boolean } | null {
  const historyPath = getHistoryPath(type, slug)

  if (!historyPath) {
    return null // Invalid path
  }

  if (!fs.existsSync(historyPath)) {
    return { entries: [], isLegacy: false }
  }

  try {
    const data = fs.readFileSync(historyPath, 'utf-8')
    const parsed: StoredHistory = JSON.parse(data)

    if (isLegacyFormat(parsed)) {
      // Convert legacy format to delta format on read
      const deltaEntries = convertToDeltaFormat(parsed)
      return { entries: deltaEntries, isLegacy: true }
    }

    return { entries: parsed.entries, isLegacy: false }
  } catch {
    return { entries: [], isLegacy: false }
  }
}

/**
 * Save version history for a document (always saves in delta format)
 */
function saveHistory(type: 'post' | 'page', slug: string, entries: DeltaVersionEntry[]): boolean {
  ensureHistoryDir()
  const historyPath = getHistoryPath(type, slug)

  if (!historyPath) {
    return false // Invalid path
  }

  const historyFile: HistoryFile = {
    version: 2,
    useDelta: true,
    entries
  }

  fs.writeFileSync(historyPath, JSON.stringify(historyFile, null, 2))
  return true
}

/**
 * Get full content for a version (reconstructs from deltas if needed)
 */
function getVersionContent(entries: DeltaVersionEntry[], versionId: string): string | null {
  const version = entries.find(v => v.id === versionId)
  if (!version) {
    return null
  }

  // If it's a base version with content, return directly
  if (version.isBase && version.content) {
    return version.content
  }

  // Reconstruct from delta chain
  return reconstructContent(entries, versionId)
}

/**
 * Save a new version of a document
 */
export const saveVersion = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(saveVersionInputSchema, data))
  .handler(async ({ data }) => {
    const { type, slug, content } = data

    const history = loadHistoryWithFallback(type, slug)

    if (history === null) {
      throw new Error('Invalid slug')
    }

    const { entries, isLegacy, migrated } = history

    // Get latest version content for comparison
    let latestContent: string | null = null
    if (entries.length > 0) {
      latestContent = getVersionContent(entries, entries[0].id)
    }

    // Check if content is different from latest version
    if (latestContent === content) {
      return { saved: false, message: 'No changes from previous version' }
    }

    // Sanitize slug for storage
    const sanitized = sanitizeSlug(slug)
    if (!sanitized.isValid) {
      throw new Error('Invalid slug')
    }

    // Create new version entry
    let newEntry: DeltaVersionEntry

    if (entries.length === 0 || latestContent === null) {
      // First version or no previous content - store as base
      newEntry = {
        id: generateVersionId(),
        timestamp: Date.now(),
        type,
        slug: sanitized.sanitized,
        summary: extractSummary(content),
        content,
        isBase: true
      }
    } else {
      // Create delta from previous version
      const delta = createDelta(latestContent, content)
      newEntry = {
        id: generateVersionId(),
        timestamp: Date.now(),
        type,
        slug: sanitized.sanitized,
        summary: extractSummary(content),
        delta,
        isBase: false
      }
    }

    // Add new version at the beginning
    entries.unshift(newEntry)

    // Keep only MAX_VERSIONS
    let trimmedEntries = entries.slice(0, MAX_VERSIONS)

    // Compact history to prevent long delta chains
    trimmedEntries = compactHistory(trimmedEntries, MAX_CHAIN_LENGTH)

    const saved = saveHistory(type, slug, trimmedEntries)
    if (!saved) {
      throw new Error('Failed to save version')
    }

    return {
      saved: true,
      versionId: newEntry.id,
      versionsKept: trimmedEntries.length,
      migratedFromLegacy: isLegacy || migrated
    }
  })

/**
 * Get version history list (without full content)
 */
export const getVersionHistory = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getVersionHistoryInputSchema, data))
  .handler(async ({ data }): Promise<VersionList> => {
    const { type, slug } = data

    const history = loadHistoryWithFallback(type, slug)

    if (history === null) {
      throw new Error('Invalid slug')
    }

    // Return versions without content for list display
    return {
      versions: history.entries.map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        type: v.type,
        slug: v.slug,
        summary: v.summary
      }))
    }
  })

// Version ID schema for validation
const versionIdSchema = z.string().min(1).max(100).regex(/^v\d+_[a-z0-9]+$/, 'Invalid version ID format')

const getVersionInputSchema = z.object({
  type: historyTypeSchema,
  slug: slugSchema,
  versionId: versionIdSchema
})

/**
 * Get a specific version's full content
 */
export const getVersion = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getVersionInputSchema, data))
  .handler(async ({ data }) => {
    const { type, slug, versionId } = data

    const history = loadHistoryWithFallback(type, slug)

    if (history === null) {
      throw new Error('Invalid slug')
    }

    const version = history.entries.find(v => v.id === versionId)

    if (!version) {
      throw new Error('Version not found')
    }

    // Reconstruct full content
    const content = getVersionContent(history.entries, versionId)
    if (content === null) {
      throw new Error('Failed to reconstruct version content')
    }

    // Return in legacy format for API compatibility
    return {
      id: version.id,
      timestamp: version.timestamp,
      content,
      type: version.type,
      slug: version.slug,
      summary: version.summary
    } as VersionEntry
  })

/**
 * Delete a specific version
 * Note: Deleting a base version will cause issues - we handle this by promoting the next version
 */
export const deleteVersion = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(getVersionInputSchema, data))
  .handler(async ({ data }) => {
    const { type, slug, versionId } = data

    const history = loadHistoryWithFallback(type, slug)

    if (history === null) {
      throw new Error('Invalid slug')
    }

    const versionIndex = history.entries.findIndex(v => v.id === versionId)
    if (versionIndex === -1) {
      throw new Error('Version not found')
    }

    const version = history.entries[versionIndex]

    // If deleting a base version, we need to promote the next version
    if (version.isBase && history.entries.length > 1) {
      // Find the next version in chain (the one that depends on this base)
      const nextVersionIndex = versionIndex - 1
      if (nextVersionIndex >= 0) {
        const nextVersion = history.entries[nextVersionIndex]
        // Reconstruct full content for the next version and make it a base
        const content = getVersionContent(history.entries, nextVersion.id)
        if (content) {
          history.entries[nextVersionIndex] = {
            ...nextVersion,
            content,
            delta: undefined,
            isBase: true
          }
        }
      }
    }

    const filteredEntries = history.entries.filter(v => v.id !== versionId)

    const saved = saveHistory(type, slug, filteredEntries)
    if (!saved) {
      throw new Error('Failed to save history')
    }

    return { deleted: true }
  })

/**
 * Clear all version history for a document
 */
export const clearHistory = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(getVersionHistoryInputSchema, data))
  .handler(async ({ data }) => {
    const { type, slug } = data

    const historyPath = getHistoryPath(type, slug)

    if (!historyPath) {
      throw new Error('Invalid slug')
    }

    if (fs.existsSync(historyPath)) {
      fs.unlinkSync(historyPath)
    }

    if (type === 'post' && isLikelyId(slug)) {
      const legacySlug = resolveLegacySlugForId(slug)
      if (legacySlug) {
        const legacyPath = getHistoryPath(type, legacySlug)
        if (legacyPath && fs.existsSync(legacyPath)) {
          fs.unlinkSync(legacyPath)
        }
      }
    }

    return { cleared: true }
  })

// Compare versions schema
const compareVersionsInputSchema = z.object({
  type: historyTypeSchema,
  slug: slugSchema,
  versionId1: versionIdSchema,
  versionId2: versionIdSchema
})

/**
 * Compare two versions and return a simple diff summary
 */
export const compareVersions = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(compareVersionsInputSchema, data))
  .handler(async ({ data }) => {
    const { type, slug, versionId1, versionId2 } = data

    const history = loadHistoryWithFallback(type, slug)

    if (history === null) {
      throw new Error('Invalid slug')
    }

    const v1 = history.entries.find(v => v.id === versionId1)
    const v2 = history.entries.find(v => v.id === versionId2)

    if (!v1 || !v2) {
      throw new Error('One or both versions not found')
    }

    // Reconstruct full content for both versions
    const content1 = getVersionContent(history.entries, versionId1)
    const content2 = getVersionContent(history.entries, versionId2)

    if (!content1 || !content2) {
      throw new Error('Failed to reconstruct version content')
    }

    const lines1 = content1.split('\n')
    const lines2 = content2.split('\n')

    return {
      version1: {
        id: v1.id,
        timestamp: v1.timestamp,
        lineCount: lines1.length,
        charCount: content1.length
      },
      version2: {
        id: v2.id,
        timestamp: v2.timestamp,
        lineCount: lines2.length,
        charCount: content2.length
      },
      diff: {
        linesDiff: lines2.length - lines1.length,
        charsDiff: content2.length - content1.length
      }
    }
  })
