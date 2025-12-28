import fs from 'node:fs'
import path from 'node:path'
import { findPostFileByIdentifier } from './post-file-locator'
import { convertToDeltaFormat, type DeltaVersionEntry } from '../../lib/history/delta-storage'

type HistoryMigrationReason =
  | 'already-id'
  | 'no-article-id'
  | 'empty-history'
  | 'id-history-exists'
  | 'invalid-slug'

export interface HistoryMigrationResult {
  migrated: number
  skipped: number
  details: Array<{ file: string; status: 'migrated' | 'skipped'; reason?: HistoryMigrationReason; id?: string }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isLikelyId(value: string): boolean {
  return UUID_REGEX.test(value) || value.startsWith('legacy-')
}

type StoredHistory = { version: 2; useDelta: true; entries: DeltaVersionEntry[] } | Array<{
  id: string
  timestamp: number
  content: string
  type: 'post' | 'page'
  slug: string
  summary?: string
}>

function loadHistoryFile(historyDir: string, slug: string): { entries: DeltaVersionEntry[] } | null {
  const historyPath = path.join(historyDir, `post_${slug}.json`)
  if (!fs.existsSync(historyPath)) return { entries: [] }
  try {
    const data = fs.readFileSync(historyPath, 'utf-8')
    const parsed: StoredHistory = JSON.parse(data)
    if (Array.isArray(parsed)) {
      return { entries: convertToDeltaFormat(parsed) }
    }
    return { entries: parsed.entries ?? [] }
  } catch {
    return { entries: [] }
  }
}

function saveHistoryFile(historyDir: string, slug: string, entries: DeltaVersionEntry[]): void {
  const historyPath = path.join(historyDir, `post_${slug}.json`)
  const payload = {
    version: 2,
    useDelta: true,
    entries
  }
  fs.writeFileSync(historyPath, JSON.stringify(payload, null, 2))
}

export function migrateHistoryFilesToIds(options: { dryRun?: boolean } = {}): HistoryMigrationResult {
  const historyDir = path.join(process.cwd(), 'content', '.history')
  if (!fs.existsSync(historyDir)) {
    return { migrated: 0, skipped: 0, details: [] }
  }

  const historyFiles = fs.readdirSync(historyDir)
    .filter(file => file.startsWith('post_') && file.endsWith('.json'))

  const contentDir = path.join(process.cwd(), 'content')
  const draftsDir = path.join(contentDir, 'drafts')
  const publishedDir = path.join(contentDir, 'published')

  let migrated = 0
  let skipped = 0
  const details: HistoryMigrationResult['details'] = []

  for (const file of historyFiles) {
    const slug = file.replace(/^post_/, '').replace(/\.json$/, '')
    if (!slug || isLikelyId(slug)) {
      skipped += 1
      details.push({ file, status: 'skipped', reason: slug ? 'already-id' : 'invalid-slug' })
      continue
    }

    const match = findPostFileByIdentifier(draftsDir, slug) || findPostFileByIdentifier(publishedDir, slug)
    if (!match?.articleId) {
      skipped += 1
      details.push({ file, status: 'skipped', reason: 'no-article-id' })
      continue
    }

    const legacyHistory = loadHistoryFile(historyDir, slug)
    if (!legacyHistory || legacyHistory.entries.length === 0) {
      skipped += 1
      details.push({ file, status: 'skipped', reason: 'empty-history', id: match.articleId })
      continue
    }

    const idHistory = loadHistoryFile(historyDir, match.articleId)
    const hasIdHistory = idHistory && idHistory.entries.length > 0
    if (!hasIdHistory) {
      if (!options.dryRun) {
        saveHistoryFile(historyDir, match.articleId, legacyHistory.entries)
      }
      details.push({ file, status: 'migrated', id: match.articleId })
      migrated += 1
      continue
    }

    skipped += 1
    details.push({ file, status: 'skipped', reason: 'id-history-exists', id: match.articleId })
  }

  return { migrated, skipped, details }
}
