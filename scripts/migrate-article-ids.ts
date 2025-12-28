/**
 * Migration Script: Add article_id (UUID) to existing posts
 *
 * This script:
 * 1. Scans all markdown files in content/published and content/drafts
 * 2. Adds a UUID article_id to posts that don't have one
 * 3. Updates queue items to link by UUID instead of just slug
 *
 * Run with: npx tsx scripts/migrate-article-ids.ts
 */

import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const PUBLISHED_DIR = path.join(CONTENT_DIR, 'published')
const DRAFTS_DIR = path.join(CONTENT_DIR, 'drafts')
const DB_PATH = path.join(CONTENT_DIR, 'seo-planner.db')

interface MigrationResult {
  file: string
  articleId: string
  slug: string
  status: 'added' | 'skipped' | 'error'
  error?: string
}

function getSlugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>, body: string, raw: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content, raw: '' }
  }

  const raw = match[1] ?? ''
  const body = match[2] ?? ''
  const frontmatter: Record<string, string> = {}

  raw.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':')
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      frontmatter[key] = value
    }
  })

  return { frontmatter, body, raw }
}

function migrateFile(filePath: string): MigrationResult {
  const filename = path.basename(filePath)
  const slug = getSlugFromFilename(filename)

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { frontmatter, body, raw } = parseFrontmatter(content)

    // Check if already has article_id
    if (frontmatter['article_id']) {
      return {
        file: filename,
        articleId: frontmatter['article_id'],
        slug,
        status: 'skipped'
      }
    }

    // Generate new UUID
    const articleId = randomUUID()

    // Rebuild frontmatter with article_id at the top
    const newFrontmatter = `---\narticle_id: ${articleId}\n${raw}\n---`
    const newContent = `${newFrontmatter}\n${body}`

    fs.writeFileSync(filePath, newContent, 'utf-8')

    return {
      file: filename,
      articleId,
      slug,
      status: 'added'
    }
  } catch (error) {
    return {
      file: filename,
      articleId: '',
      slug,
      status: 'error',
      error: String(error)
    }
  }
}

function updateQueueItems(results: MigrationResult[]) {
  if (!fs.existsSync(DB_PATH)) {
    console.log('No SEO planner database found, skipping queue update')
    return
  }

  const db = new Database(DB_PATH)

  // Ensure the column exists
  try {
    db.exec('ALTER TABLE article_queue ADD COLUMN assigned_article_id TEXT')
  } catch {
    // Column already exists
  }

  const updateStmt = db.prepare(`
    UPDATE article_queue
    SET assigned_article_id = ?
    WHERE assigned_post_slug = ?
  `)

  let updated = 0
  for (const result of results) {
    if (result.status === 'added' && result.articleId) {
      const info = updateStmt.run(result.articleId, result.slug)
      if (info.changes > 0) {
        updated++
        console.log(`  Updated queue item for slug: ${result.slug}`)
      }
    }
  }

  db.close()
  console.log(`\nUpdated ${updated} queue items with article IDs`)
}

function migrate() {
  console.log('Article ID Migration Script')
  console.log('==========================\n')

  const results: MigrationResult[] = []

  // Process published directory
  if (fs.existsSync(PUBLISHED_DIR)) {
    console.log('Processing published posts...')
    const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const result = migrateFile(path.join(PUBLISHED_DIR, file))
      results.push(result)
      console.log(`  ${result.status === 'added' ? '+' : result.status === 'skipped' ? '-' : '!'} ${file}`)
    }
  }

  // Process drafts directory
  if (fs.existsSync(DRAFTS_DIR)) {
    console.log('\nProcessing draft posts...')
    const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const result = migrateFile(path.join(DRAFTS_DIR, file))
      results.push(result)
      console.log(`  ${result.status === 'added' ? '+' : result.status === 'skipped' ? '-' : '!'} ${file}`)
    }
  }

  // Summary
  const added = results.filter(r => r.status === 'added').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors = results.filter(r => r.status === 'error').length

  console.log('\n==========================')
  console.log('Migration Summary:')
  console.log(`  Added:   ${added}`)
  console.log(`  Skipped: ${skipped} (already had article_id)`)
  console.log(`  Errors:  ${errors}`)

  if (errors > 0) {
    console.log('\nErrors:')
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`  ${r.file}: ${r.error}`)
    })
  }

  // Update queue items
  if (added > 0) {
    console.log('\nUpdating queue items...')
    updateQueueItems(results)
  }

  console.log('\nMigration complete!')
}

// Run migration
migrate()
