import Database from 'better-sqlite3'
import path from 'path'

// Use same database as auth (could also be separate media.db if preferred)
const db = new Database(path.join(process.cwd(), 'content', 'media.db'))

// Initialize media table
db.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('upload', 'ai-generated', 'manual')),
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    file_size INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    description TEXT,
    keywords TEXT,
    original_filename TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Create indexes for efficient searching
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_media_source ON media(source);
  CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);
  CREATE INDEX IF NOT EXISTS idx_media_alt_text ON media(alt_text);
`)

export interface MediaItem {
  id: number
  filename: string
  url: string
  source: 'upload' | 'ai-generated' | 'manual'
  mimeType: string
  fileSize: number
  width?: number
  height?: number
  altText?: string
  description?: string
  keywords?: string[]
  originalFilename?: string
  createdAt: string
  updatedAt: string
}

export interface CreateMediaInput {
  filename: string
  url: string
  source: 'upload' | 'ai-generated' | 'manual'
  mimeType?: string
  fileSize: number
  width?: number
  height?: number
  altText?: string
  description?: string
  keywords?: string[]
  originalFilename?: string
}

export interface UpdateMediaInput {
  altText?: string
  description?: string
  keywords?: string[]
}

export interface MediaSearchOptions {
  query?: string
  source?: 'upload' | 'ai-generated' | 'manual' | 'all'
  limit?: number
  offset?: number
  sortBy?: 'created_at' | 'filename' | 'file_size'
  sortOrder?: 'asc' | 'desc'
}

// Convert DB row to MediaItem
function rowToMediaItem(row: Record<string, unknown>): MediaItem {
  return {
    id: row.id as number,
    filename: row.filename as string,
    url: row.url as string,
    source: row.source as 'upload' | 'ai-generated' | 'manual',
    mimeType: row.mime_type as string,
    fileSize: row.file_size as number,
    width: row.width as number | undefined,
    height: row.height as number | undefined,
    altText: row.alt_text as string | undefined,
    description: row.description as string | undefined,
    keywords: row.keywords ? JSON.parse(row.keywords as string) : undefined,
    originalFilename: row.original_filename as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/**
 * Create a new media record
 */
export function createMedia(input: CreateMediaInput): MediaItem {
  const stmt = db.prepare(`
    INSERT INTO media (filename, url, source, mime_type, file_size, width, height, alt_text, description, keywords, original_filename)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    input.filename,
    input.url,
    input.source,
    input.mimeType || 'image/webp',
    input.fileSize,
    input.width || null,
    input.height || null,
    input.altText || null,
    input.description || null,
    input.keywords ? JSON.stringify(input.keywords) : null,
    input.originalFilename || null
  )

  return getMediaById(result.lastInsertRowid as number)!
}

/**
 * Get a media item by ID
 */
export function getMediaById(id: number): MediaItem | null {
  const stmt = db.prepare('SELECT * FROM media WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | undefined
  return row ? rowToMediaItem(row) : null
}

/**
 * Get a media item by filename
 */
export function getMediaByFilename(filename: string): MediaItem | null {
  const stmt = db.prepare('SELECT * FROM media WHERE filename = ?')
  const row = stmt.get(filename) as Record<string, unknown> | undefined
  return row ? rowToMediaItem(row) : null
}

/**
 * Get a media item by URL
 */
export function getMediaByUrl(url: string): MediaItem | null {
  const stmt = db.prepare('SELECT * FROM media WHERE url = ?')
  const row = stmt.get(url) as Record<string, unknown> | undefined
  return row ? rowToMediaItem(row) : null
}

/**
 * Update a media item
 */
export function updateMedia(id: number, input: UpdateMediaInput): MediaItem | null {
  const updates: string[] = []
  const values: (string | null)[] = []

  if (input.altText !== undefined) {
    updates.push('alt_text = ?')
    values.push(input.altText)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }
  if (input.keywords !== undefined) {
    updates.push('keywords = ?')
    values.push(JSON.stringify(input.keywords))
  }

  if (updates.length === 0) {
    return getMediaById(id)
  }

  updates.push("updated_at = datetime('now')")
  values.push(id.toString())

  const stmt = db.prepare(`
    UPDATE media SET ${updates.join(', ')} WHERE id = ?
  `)
  stmt.run(...values.slice(0, -1), id)

  return getMediaById(id)
}

/**
 * Delete a media item
 */
export function deleteMedia(id: number): boolean {
  const stmt = db.prepare('DELETE FROM media WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

/**
 * Delete a media item by filename
 */
export function deleteMediaByFilename(filename: string): boolean {
  const stmt = db.prepare('DELETE FROM media WHERE filename = ?')
  const result = stmt.run(filename)
  return result.changes > 0
}

/**
 * Search and list media items
 */
export function searchMedia(options: MediaSearchOptions = {}): { items: MediaItem[]; total: number } {
  const {
    query,
    source = 'all',
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options

  const conditions: string[] = []
  const params: (string | number)[] = []

  // Source filter
  if (source !== 'all') {
    conditions.push('source = ?')
    params.push(source)
  }

  // Search query (searches filename, alt_text, description, keywords)
  if (query) {
    conditions.push(`(
      filename LIKE ? OR
      alt_text LIKE ? OR
      description LIKE ? OR
      keywords LIKE ?
    )`)
    const likeQuery = `%${query}%`
    params.push(likeQuery, likeQuery, likeQuery, likeQuery)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM media ${whereClause}`)
  const countResult = countStmt.get(...params) as { count: number }
  const total = countResult.count

  // Get items with pagination
  const validSortColumns = ['created_at', 'filename', 'file_size']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

  const stmt = db.prepare(`
    SELECT * FROM media
    ${whereClause}
    ORDER BY ${sortColumn} ${order}
    LIMIT ? OFFSET ?
  `)

  const rows = stmt.all(...params, limit, offset) as Record<string, unknown>[]
  const items = rows.map(rowToMediaItem)

  return { items, total }
}

/**
 * Get all media items (for migration/sync)
 */
export function getAllMedia(): MediaItem[] {
  const stmt = db.prepare('SELECT * FROM media ORDER BY created_at DESC')
  const rows = stmt.all() as Record<string, unknown>[]
  return rows.map(rowToMediaItem)
}

/**
 * Check if a media item exists by filename
 */
export function mediaExists(filename: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM media WHERE filename = ?')
  return stmt.get(filename) !== undefined
}

/**
 * Get media stats
 */
export function getMediaStats(): {
  total: number
  bySource: Record<string, number>
  totalSize: number
} {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM media')
  const total = (totalStmt.get() as { count: number }).count

  const bySourceStmt = db.prepare('SELECT source, COUNT(*) as count FROM media GROUP BY source')
  const bySourceRows = bySourceStmt.all() as { source: string; count: number }[]
  const bySource: Record<string, number> = {}
  for (const row of bySourceRows) {
    bySource[row.source] = row.count
  }

  const sizeStmt = db.prepare('SELECT SUM(file_size) as total FROM media')
  const totalSize = (sizeStmt.get() as { total: number | null }).total || 0

  return { total, bySource, totalSize }
}
