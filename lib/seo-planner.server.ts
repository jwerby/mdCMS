/**
 * SEO Content Planner Database
 * Manages GSC credentials, keywords, article queue, and sync history
 */

import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'content', 'seo-planner.db'))

// Initialize tables
db.exec(`
  -- OAuth Credentials (singleton table)
  CREATE TABLE IF NOT EXISTS gsc_credentials (
    id INTEGER PRIMARY KEY DEFAULT 1,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    site_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (id = 1)
  );

  -- Keywords from GSC
  CREATE TABLE IF NOT EXISTS gsc_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    page_url TEXT,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    position REAL DEFAULT 0,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(keyword, page_url, date)
  );

  -- Article Queue
  CREATE TABLE IF NOT EXISTS article_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_keywords TEXT NOT NULL,
    status TEXT DEFAULT 'idea' CHECK(status IN ('idea', 'research', 'outline', 'draft', 'published')),
    priority_score REAL DEFAULT 0,
    category TEXT,
    notes TEXT,
    source_keyword_id INTEGER,
    estimated_traffic INTEGER,
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
    assigned_post_slug TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_keyword_id) REFERENCES gsc_keywords(id)
  );

  -- Sync History
  CREATE TABLE IF NOT EXISTS gsc_sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL CHECK(sync_type IN ('full', 'incremental')),
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
    records_fetched INTEGER DEFAULT 0,
    date_range_start TEXT,
    date_range_end TEXT,
    error_message TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );
`)

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON gsc_keywords(keyword);
  CREATE INDEX IF NOT EXISTS idx_keywords_date ON gsc_keywords(date);
  CREATE INDEX IF NOT EXISTS idx_keywords_position ON gsc_keywords(position);
  CREATE INDEX IF NOT EXISTS idx_keywords_impressions ON gsc_keywords(impressions);
  CREATE INDEX IF NOT EXISTS idx_queue_status ON article_queue(status);
  CREATE INDEX IF NOT EXISTS idx_queue_priority ON article_queue(priority_score);
  CREATE INDEX IF NOT EXISTS idx_sync_started ON gsc_sync_history(started_at);
`)

// Migration: Add instructions column to article_queue if it doesn't exist
try {
  db.exec(`ALTER TABLE article_queue ADD COLUMN instructions TEXT`)
} catch {
  // Column already exists, ignore
}

// Migration: Add assigned_article_id column for UUID-based post linking
try {
  db.exec(`ALTER TABLE article_queue ADD COLUMN assigned_article_id TEXT`)
} catch {
  // Column already exists, ignore
}

// ============================================================================
// Types
// ============================================================================

export interface GSCCredentials {
  id: number
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: number
  siteUrl?: string
  createdAt: string
  updatedAt: string
}

export interface GSCKeyword {
  id: number
  keyword: string
  pageUrl?: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  date: string
  createdAt: string
}

export type QueueStatus = 'idea' | 'research' | 'outline' | 'draft' | 'published'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface ArticleQueueItem {
  id: number
  title: string
  targetKeywords: string[]
  status: QueueStatus
  priorityScore: number
  category?: string
  notes?: string
  instructions?: string
  sourceKeywordId?: number
  estimatedTraffic?: number
  difficulty?: Difficulty
  assignedPostSlug?: string
  assignedArticleId?: string  // UUID - immutable reference to post
  createdAt: string
  updatedAt: string
}

export interface SyncHistoryEntry {
  id: number
  syncType: 'full' | 'incremental'
  status: 'running' | 'completed' | 'failed'
  recordsFetched: number
  dateRangeStart?: string
  dateRangeEnd?: string
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

// ============================================================================
// Row Converters
// ============================================================================

function rowToCredentials(row: Record<string, unknown>): GSCCredentials {
  return {
    id: row.id as number,
    clientId: row.client_id as string,
    clientSecret: row.client_secret as string,
    accessToken: row.access_token as string | undefined,
    refreshToken: row.refresh_token as string | undefined,
    tokenExpiry: row.token_expiry as number | undefined,
    siteUrl: row.site_url as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToKeyword(row: Record<string, unknown>): GSCKeyword {
  return {
    id: row.id as number,
    keyword: row.keyword as string,
    pageUrl: row.page_url as string | undefined,
    impressions: row.impressions as number,
    clicks: row.clicks as number,
    ctr: row.ctr as number,
    position: row.position as number,
    date: row.date as string,
    createdAt: row.created_at as string,
  }
}

function rowToQueueItem(row: Record<string, unknown>): ArticleQueueItem {
  return {
    id: row.id as number,
    title: row.title as string,
    targetKeywords: JSON.parse(row.target_keywords as string),
    status: row.status as QueueStatus,
    priorityScore: row.priority_score as number,
    category: row.category as string | undefined,
    notes: row.notes as string | undefined,
    instructions: row.instructions as string | undefined,
    sourceKeywordId: row.source_keyword_id as number | undefined,
    estimatedTraffic: row.estimated_traffic as number | undefined,
    difficulty: row.difficulty as Difficulty | undefined,
    assignedPostSlug: row.assigned_post_slug as string | undefined,
    assignedArticleId: row.assigned_article_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToSyncHistory(row: Record<string, unknown>): SyncHistoryEntry {
  return {
    id: row.id as number,
    syncType: row.sync_type as 'full' | 'incremental',
    status: row.status as 'running' | 'completed' | 'failed',
    recordsFetched: row.records_fetched as number,
    dateRangeStart: row.date_range_start as string | undefined,
    dateRangeEnd: row.date_range_end as string | undefined,
    errorMessage: row.error_message as string | undefined,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | undefined,
  }
}

// ============================================================================
// Credentials CRUD
// ============================================================================

export function getCredentials(): GSCCredentials | null {
  const stmt = db.prepare('SELECT * FROM gsc_credentials WHERE id = 1')
  const row = stmt.get() as Record<string, unknown> | undefined
  return row ? rowToCredentials(row) : null
}

export function saveCredentials(input: {
  clientId: string
  clientSecret: string
  siteUrl: string
}): GSCCredentials {
  const existing = getCredentials()

  if (existing) {
    const stmt = db.prepare(`
      UPDATE gsc_credentials
      SET client_id = ?, client_secret = ?, site_url = ?, updated_at = datetime('now')
      WHERE id = 1
    `)
    stmt.run(input.clientId, input.clientSecret, input.siteUrl)
  } else {
    const stmt = db.prepare(`
      INSERT INTO gsc_credentials (id, client_id, client_secret, site_url)
      VALUES (1, ?, ?, ?)
    `)
    stmt.run(input.clientId, input.clientSecret, input.siteUrl)
  }

  return getCredentials()!
}

export function saveTokens(input: {
  accessToken: string
  refreshToken: string
  expiresIn: number
}): GSCCredentials | null {
  const tokenExpiry = Math.floor(Date.now() / 1000) + input.expiresIn

  const stmt = db.prepare(`
    UPDATE gsc_credentials
    SET access_token = ?, refresh_token = ?, token_expiry = ?, updated_at = datetime('now')
    WHERE id = 1
  `)
  stmt.run(input.accessToken, input.refreshToken, tokenExpiry)

  return getCredentials()
}

export function updateAccessToken(accessToken: string, expiresIn: number): void {
  const tokenExpiry = Math.floor(Date.now() / 1000) + expiresIn

  const stmt = db.prepare(`
    UPDATE gsc_credentials
    SET access_token = ?, token_expiry = ?, updated_at = datetime('now')
    WHERE id = 1
  `)
  stmt.run(accessToken, tokenExpiry)
}

export function saveSiteUrl(siteUrl: string): void {
  const existing = getCredentials()

  if (existing) {
    const stmt = db.prepare(`
      UPDATE gsc_credentials
      SET site_url = ?, updated_at = datetime('now')
      WHERE id = 1
    `)
    stmt.run(siteUrl)
  } else {
    // Create a minimal record with just the site URL (for service account auth)
    const stmt = db.prepare(`
      INSERT INTO gsc_credentials (id, client_id, client_secret, site_url)
      VALUES (1, '', '', ?)
    `)
    stmt.run(siteUrl)
  }
}

export function clearTokens(): void {
  const stmt = db.prepare(`
    UPDATE gsc_credentials
    SET access_token = NULL, refresh_token = NULL, token_expiry = NULL, updated_at = datetime('now')
    WHERE id = 1
  `)
  stmt.run()
}

export function isTokenExpired(): boolean {
  const creds = getCredentials()
  if (!creds?.tokenExpiry) return true

  // Consider expired if less than 5 minutes remaining
  const now = Math.floor(Date.now() / 1000)
  return now >= creds.tokenExpiry - 300
}

// ============================================================================
// Keywords CRUD
// ============================================================================

export function upsertKeyword(input: {
  keyword: string
  pageUrl?: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  date: string
}): GSCKeyword {
  const stmt = db.prepare(`
    INSERT INTO gsc_keywords (keyword, page_url, impressions, clicks, ctr, position, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(keyword, page_url, date) DO UPDATE SET
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      ctr = excluded.ctr,
      position = excluded.position
  `)

  const result = stmt.run(
    input.keyword,
    input.pageUrl || null,
    input.impressions,
    input.clicks,
    input.ctr,
    input.position,
    input.date
  )

  // Get the inserted/updated row
  const getStmt = db.prepare(`
    SELECT * FROM gsc_keywords
    WHERE keyword = ? AND (page_url = ? OR (page_url IS NULL AND ? IS NULL)) AND date = ?
  `)
  const row = getStmt.get(input.keyword, input.pageUrl || null, input.pageUrl || null, input.date) as Record<string, unknown>
  return rowToKeyword(row)
}

export function bulkUpsertKeywords(keywords: Array<{
  keyword: string
  pageUrl?: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  date: string
}>): number {
  const stmt = db.prepare(`
    INSERT INTO gsc_keywords (keyword, page_url, impressions, clicks, ctr, position, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(keyword, page_url, date) DO UPDATE SET
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      ctr = excluded.ctr,
      position = excluded.position
  `)

  const insertMany = db.transaction((items: typeof keywords) => {
    let count = 0
    for (const item of items) {
      stmt.run(
        item.keyword,
        item.pageUrl || null,
        item.impressions,
        item.clicks,
        item.ctr,
        item.position,
        item.date
      )
      count++
    }
    return count
  })

  return insertMany(keywords)
}

export function getKeywords(options: {
  limit?: number
  offset?: number
  minImpressions?: number
  minPosition?: number
  maxPosition?: number
  startDate?: string
  endDate?: string
  search?: string
  orderBy?: 'impressions' | 'clicks' | 'position' | 'ctr'
  orderDir?: 'asc' | 'desc'
} = {}): { items: GSCKeyword[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (options.minImpressions !== undefined) {
    conditions.push('impressions >= ?')
    params.push(options.minImpressions)
  }
  if (options.minPosition !== undefined) {
    conditions.push('position >= ?')
    params.push(options.minPosition)
  }
  if (options.maxPosition !== undefined) {
    conditions.push('position <= ?')
    params.push(options.maxPosition)
  }
  if (options.startDate) {
    conditions.push('date >= ?')
    params.push(options.startDate)
  }
  if (options.endDate) {
    conditions.push('date <= ?')
    params.push(options.endDate)
  }
  if (options.search) {
    conditions.push('keyword LIKE ?')
    params.push(`%${options.search}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = options.orderBy || 'impressions'
  const orderDir = options.orderDir || 'desc'

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM gsc_keywords ${whereClause}`)
  const countResult = countStmt.get(...params) as { count: number }

  // Get items
  const limit = options.limit || 50
  const offset = options.offset || 0

  const stmt = db.prepare(`
    SELECT * FROM gsc_keywords
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `)

  const rows = stmt.all(...params, limit, offset) as Record<string, unknown>[]

  return {
    items: rows.map(rowToKeyword),
    total: countResult.count,
  }
}

export function getKeywordById(id: number): GSCKeyword | null {
  const stmt = db.prepare('SELECT * FROM gsc_keywords WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | undefined
  return row ? rowToKeyword(row) : null
}

export function getKeywordStats(): {
  totalKeywords: number
  totalImpressions: number
  totalClicks: number
  avgPosition: number
  dateRange: { min: string; max: string } | null
} {
  const stmt = db.prepare(`
    SELECT
      COUNT(DISTINCT keyword) as total_keywords,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(position) as avg_position,
      MIN(date) as min_date,
      MAX(date) as max_date
    FROM gsc_keywords
  `)

  const row = stmt.get() as Record<string, unknown>

  return {
    totalKeywords: (row.total_keywords as number) || 0,
    totalImpressions: (row.total_impressions as number) || 0,
    totalClicks: (row.total_clicks as number) || 0,
    avgPosition: (row.avg_position as number) || 0,
    dateRange: row.min_date ? {
      min: row.min_date as string,
      max: row.max_date as string,
    } : null,
  }
}

export function deleteOldKeywords(beforeDate: string): number {
  const stmt = db.prepare('DELETE FROM gsc_keywords WHERE date < ?')
  const result = stmt.run(beforeDate)
  return result.changes
}

// ============================================================================
// Article Queue CRUD
// ============================================================================

export function createQueueItem(input: {
  title: string
  targetKeywords: string[]
  category?: string
  notes?: string
  instructions?: string
  sourceKeywordId?: number
  estimatedTraffic?: number
  difficulty?: Difficulty
}): ArticleQueueItem {
  // Calculate priority score
  let priorityScore = 50 // Base score

  if (input.sourceKeywordId) {
    const keyword = getKeywordById(input.sourceKeywordId)
    if (keyword) {
      priorityScore = calculatePriorityScore(keyword)
    }
  }

  const stmt = db.prepare(`
    INSERT INTO article_queue (title, target_keywords, category, notes, instructions, source_keyword_id, estimated_traffic, difficulty, priority_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    input.title,
    JSON.stringify(input.targetKeywords),
    input.category || null,
    input.notes || null,
    input.instructions || null,
    input.sourceKeywordId || null,
    input.estimatedTraffic || null,
    input.difficulty || null,
    priorityScore
  )

  return getQueueItemById(result.lastInsertRowid as number)!
}

export function getQueueItems(options: {
  status?: QueueStatus | 'all'
  category?: string
  limit?: number
  offset?: number
  orderBy?: 'priority_score' | 'created_at' | 'title'
  orderDir?: 'asc' | 'desc'
} = {}): { items: ArticleQueueItem[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (options.status && options.status !== 'all') {
    conditions.push('status = ?')
    params.push(options.status)
  }
  if (options.category) {
    conditions.push('category = ?')
    params.push(options.category)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = options.orderBy || 'priority_score'
  const orderDir = options.orderDir || 'desc'

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM article_queue ${whereClause}`)
  const countResult = countStmt.get(...params) as { count: number }

  // Get items
  const limit = options.limit || 50
  const offset = options.offset || 0

  const stmt = db.prepare(`
    SELECT * FROM article_queue
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `)

  const rows = stmt.all(...params, limit, offset) as Record<string, unknown>[]

  return {
    items: rows.map(rowToQueueItem),
    total: countResult.count,
  }
}

export function getQueueItemById(id: number): ArticleQueueItem | null {
  const stmt = db.prepare('SELECT * FROM article_queue WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | undefined
  return row ? rowToQueueItem(row) : null
}

export function updateQueueItem(id: number, input: {
  title?: string
  targetKeywords?: string[]
  status?: QueueStatus
  category?: string
  notes?: string
  instructions?: string
  difficulty?: Difficulty
  assignedPostSlug?: string
  assignedArticleId?: string
}): ArticleQueueItem | null {
  const updates: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) {
    updates.push('title = ?')
    params.push(input.title)
  }
  if (input.targetKeywords !== undefined) {
    updates.push('target_keywords = ?')
    params.push(JSON.stringify(input.targetKeywords))
  }
  if (input.status !== undefined) {
    updates.push('status = ?')
    params.push(input.status)
  }
  if (input.category !== undefined) {
    updates.push('category = ?')
    params.push(input.category)
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?')
    params.push(input.notes)
  }
  if (input.instructions !== undefined) {
    updates.push('instructions = ?')
    params.push(input.instructions)
  }
  if (input.difficulty !== undefined) {
    updates.push('difficulty = ?')
    params.push(input.difficulty)
  }
  if (input.assignedPostSlug !== undefined) {
    updates.push('assigned_post_slug = ?')
    params.push(input.assignedPostSlug)
  }
  if (input.assignedArticleId !== undefined) {
    updates.push('assigned_article_id = ?')
    params.push(input.assignedArticleId)
  }

  if (updates.length === 0) return getQueueItemById(id)

  updates.push("updated_at = datetime('now')")
  params.push(id)

  const stmt = db.prepare(`
    UPDATE article_queue
    SET ${updates.join(', ')}
    WHERE id = ?
  `)
  stmt.run(...params)

  return getQueueItemById(id)
}

export function deleteQueueItem(id: number): boolean {
  const stmt = db.prepare('DELETE FROM article_queue WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function getQueueStats(): {
  total: number
  byStatus: Record<QueueStatus, number>
  byCategory: Record<string, number>
} {
  const statusStmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM article_queue
    GROUP BY status
  `)
  const statusRows = statusStmt.all() as Array<{ status: QueueStatus; count: number }>

  const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM article_queue
    WHERE category IS NOT NULL
    GROUP BY category
  `)
  const categoryRows = categoryStmt.all() as Array<{ category: string; count: number }>

  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM article_queue')
  const totalResult = totalStmt.get() as { count: number }

  const byStatus: Record<QueueStatus, number> = {
    idea: 0,
    research: 0,
    outline: 0,
    draft: 0,
    published: 0,
  }

  for (const row of statusRows) {
    byStatus[row.status] = row.count
  }

  const byCategory: Record<string, number> = {}
  for (const row of categoryRows) {
    byCategory[row.category] = row.count
  }

  return {
    total: totalResult.count,
    byStatus,
    byCategory,
  }
}

// ============================================================================
// Sync History CRUD
// ============================================================================

export function createSyncEntry(input: {
  syncType: 'full' | 'incremental'
  dateRangeStart?: string
  dateRangeEnd?: string
}): SyncHistoryEntry {
  const stmt = db.prepare(`
    INSERT INTO gsc_sync_history (sync_type, status, date_range_start, date_range_end)
    VALUES (?, 'running', ?, ?)
  `)

  const result = stmt.run(input.syncType, input.dateRangeStart || null, input.dateRangeEnd || null)
  return getSyncEntryById(result.lastInsertRowid as number)!
}

export function updateSyncEntry(id: number, input: {
  status?: 'running' | 'completed' | 'failed'
  recordsFetched?: number
  errorMessage?: string
}): SyncHistoryEntry | null {
  const updates: string[] = []
  const params: unknown[] = []

  if (input.status !== undefined) {
    updates.push('status = ?')
    params.push(input.status)

    if (input.status === 'completed' || input.status === 'failed') {
      updates.push("completed_at = datetime('now')")
    }
  }
  if (input.recordsFetched !== undefined) {
    updates.push('records_fetched = ?')
    params.push(input.recordsFetched)
  }
  if (input.errorMessage !== undefined) {
    updates.push('error_message = ?')
    params.push(input.errorMessage)
  }

  if (updates.length === 0) return getSyncEntryById(id)

  params.push(id)

  const stmt = db.prepare(`
    UPDATE gsc_sync_history
    SET ${updates.join(', ')}
    WHERE id = ?
  `)
  stmt.run(...params)

  return getSyncEntryById(id)
}

export function getSyncEntryById(id: number): SyncHistoryEntry | null {
  const stmt = db.prepare('SELECT * FROM gsc_sync_history WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | undefined
  return row ? rowToSyncHistory(row) : null
}

export function getSyncHistory(limit: number = 10): SyncHistoryEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM gsc_sync_history
    ORDER BY started_at DESC
    LIMIT ?
  `)
  const rows = stmt.all(limit) as Record<string, unknown>[]
  return rows.map(rowToSyncHistory)
}

export function getLastSuccessfulSync(): SyncHistoryEntry | null {
  const stmt = db.prepare(`
    SELECT * FROM gsc_sync_history
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `)
  const row = stmt.get() as Record<string, unknown> | undefined
  return row ? rowToSyncHistory(row) : null
}

export function getRunningSync(): SyncHistoryEntry | null {
  const stmt = db.prepare(`
    SELECT * FROM gsc_sync_history
    WHERE status = 'running'
    ORDER BY started_at DESC
    LIMIT 1
  `)
  const row = stmt.get() as Record<string, unknown> | undefined
  return row ? rowToSyncHistory(row) : null
}

// ============================================================================
// Priority Scoring
// ============================================================================

export function calculatePriorityScore(keyword: {
  impressions: number
  position: number
  ctr: number
}): number {
  // Base: log scale impressions (0-100 range roughly)
  const impressionScore = Math.log10(keyword.impressions + 1) * 20

  // Position multiplier
  let positionMultiplier = 1
  if (keyword.position <= 10) {
    positionMultiplier = 0.5 // Already ranking well, lower priority
  } else if (keyword.position <= 20) {
    positionMultiplier = 2.0 // Striking distance - high priority!
  } else if (keyword.position <= 30) {
    positionMultiplier = 1.5 // Moderate opportunity
  } else {
    positionMultiplier = 0.8 // Far from page 1
  }

  // Low CTR = opportunity to improve
  const ctrFactor = keyword.ctr < 0.02 ? 1.3 : 1.0

  return Math.round(impressionScore * positionMultiplier * ctrFactor * 10) / 10
}

// ============================================================================
// Aggregate Queries for Opportunities
// ============================================================================

export function getStrikingDistanceKeywords(options: {
  minImpressions?: number
  limit?: number
} = {}): GSCKeyword[] {
  const minImpressions = options.minImpressions ?? 100
  const limit = options.limit ?? 50

  // Get latest date's data for keywords between position 11-30
  const stmt = db.prepare(`
    SELECT k.* FROM gsc_keywords k
    INNER JOIN (
      SELECT keyword, MAX(date) as max_date
      FROM gsc_keywords
      GROUP BY keyword
    ) latest ON k.keyword = latest.keyword AND k.date = latest.max_date
    WHERE k.position >= 11 AND k.position <= 30
    AND k.impressions >= ?
    ORDER BY k.impressions DESC
    LIMIT ?
  `)

  const rows = stmt.all(minImpressions, limit) as Record<string, unknown>[]
  return rows.map(rowToKeyword)
}

export function getLowCTRKeywords(options: {
  minImpressions?: number
  maxCTR?: number
  limit?: number
} = {}): GSCKeyword[] {
  const minImpressions = options.minImpressions ?? 500
  const maxCTR = options.maxCTR ?? 0.02
  const limit = options.limit ?? 50

  const stmt = db.prepare(`
    SELECT k.* FROM gsc_keywords k
    INNER JOIN (
      SELECT keyword, MAX(date) as max_date
      FROM gsc_keywords
      GROUP BY keyword
    ) latest ON k.keyword = latest.keyword AND k.date = latest.max_date
    WHERE k.impressions >= ?
    AND k.ctr <= ?
    ORDER BY k.impressions DESC
    LIMIT ?
  `)

  const rows = stmt.all(minImpressions, maxCTR, limit) as Record<string, unknown>[]
  return rows.map(rowToKeyword)
}

export function getDecliningKeywords(options: {
  minPositionDrop?: number
  limit?: number
} = {}): Array<GSCKeyword & { positionChange: number; previousPosition: number }> {
  const minPositionDrop = options.minPositionDrop ?? 5
  const limit = options.limit ?? 50

  // Compare last 7 days vs previous 7 days
  const stmt = db.prepare(`
    WITH recent AS (
      SELECT keyword, AVG(position) as avg_position
      FROM gsc_keywords
      WHERE date >= date('now', '-7 days')
      GROUP BY keyword
    ),
    previous AS (
      SELECT keyword, AVG(position) as avg_position
      FROM gsc_keywords
      WHERE date >= date('now', '-14 days') AND date < date('now', '-7 days')
      GROUP BY keyword
    )
    SELECT
      k.*,
      recent.avg_position as recent_pos,
      previous.avg_position as previous_pos,
      (recent.avg_position - previous.avg_position) as position_change
    FROM gsc_keywords k
    INNER JOIN recent ON k.keyword = recent.keyword
    INNER JOIN previous ON k.keyword = previous.keyword
    INNER JOIN (
      SELECT keyword, MAX(date) as max_date
      FROM gsc_keywords
      GROUP BY keyword
    ) latest ON k.keyword = latest.keyword AND k.date = latest.max_date
    WHERE (recent.avg_position - previous.avg_position) >= ?
    ORDER BY position_change DESC
    LIMIT ?
  `)

  const rows = stmt.all(minPositionDrop, limit) as Array<Record<string, unknown>>

  return rows.map(row => ({
    ...rowToKeyword(row),
    positionChange: row.position_change as number,
    previousPosition: row.previous_pos as number,
  }))
}

export function getOpportunitySummary(): {
  strikingDistance: number
  lowCTR: number
  declining: number
  totalPotentialTraffic: number
} {
  const strikingStmt = db.prepare(`
    SELECT COUNT(DISTINCT keyword) as count FROM gsc_keywords
    WHERE position >= 11 AND position <= 30 AND impressions >= 100
  `)
  const strikingResult = strikingStmt.get() as { count: number }

  const lowCTRStmt = db.prepare(`
    SELECT COUNT(DISTINCT keyword) as count FROM gsc_keywords
    WHERE impressions >= 500 AND ctr <= 0.02
  `)
  const lowCTRResult = lowCTRStmt.get() as { count: number }

  // Estimate potential traffic from striking distance keywords
  const trafficStmt = db.prepare(`
    SELECT SUM(impressions * 0.1) as potential FROM gsc_keywords
    WHERE position >= 11 AND position <= 30 AND impressions >= 100
  `)
  const trafficResult = trafficStmt.get() as { potential: number | null }

  return {
    strikingDistance: strikingResult.count,
    lowCTR: lowCTRResult.count,
    declining: 0, // Would need date comparison which is expensive
    totalPotentialTraffic: Math.round(trafficResult.potential || 0),
  }
}
