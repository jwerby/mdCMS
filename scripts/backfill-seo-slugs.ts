import fs from 'fs'
import path from 'path'
import { parseFrontmatter, serializeFrontmatter } from '../lib/markdown/frontmatter-parser'
import { buildSeoSlugParts } from '../lib/seo/seo-slug'

type Frontmatter = Record<string, unknown>

const ROOT_DIR = process.cwd()
const DRAFTS_DIR = path.join(ROOT_DIR, 'content', 'drafts')
const PUBLISHED_DIR = path.join(ROOT_DIR, 'content', 'published')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const includePublished = args.has('--include-published')

type UpdateResult = {
  file: string
  slug: string
  urlSlug: string
  renamedFrom?: string
}

function getString(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

function getFrontmatterValue(frontmatter: Frontmatter, key: string, legacyKey?: string): string {
  return getString(frontmatter[key] ?? (legacyKey ? frontmatter[legacyKey] : ''))
}

function getSecondaryKeywords(frontmatter: Frontmatter): string[] | string {
  const secondary = frontmatter.secondary_keywords ?? frontmatter['Secondary Keywords']
  if (Array.isArray(secondary)) return secondary.map(item => String(item))
  return getString(secondary)
}

function getFilenameSlug(filename: string): { slug: string; suffix: string } {
  const base = filename.replace(/\.md$/, '')
  const dateSuffixMatch = base.match(/-\d{4}-\d{2}-\d{2}$/)
  const suffix = dateSuffixMatch ? dateSuffixMatch[0] : ''
  const slug = suffix ? base.slice(0, -suffix.length) : base
  return { slug, suffix }
}

function updateFile(filePath: string): UpdateResult | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(content)

  const metaTitle = getFrontmatterValue(frontmatter, 'meta_title', 'Meta Title')
    || getFrontmatterValue(frontmatter, 'title')
  const primaryKeyword = getFrontmatterValue(frontmatter, 'primary_keyword', 'Primary Keyword')
  const secondaryKeywords = getSecondaryKeywords(frontmatter)

  const { slug, urlSlug } = buildSeoSlugParts(primaryKeyword, metaTitle, secondaryKeywords)
  if (!slug || !urlSlug) return null

  const existingUrlSlug = getFrontmatterValue(frontmatter, 'url_slug', 'URL Slug')
  const { slug: currentFilenameSlug, suffix } = getFilenameSlug(path.basename(filePath))

  const nextFilename = `${slug}${suffix}.md`
  const nextPath = path.join(path.dirname(filePath), nextFilename)
  const needsRename = path.basename(filePath) !== nextFilename
  const needsFrontmatterUpdate = existingUrlSlug !== urlSlug || frontmatter['URL Slug']

  if (!needsRename && !needsFrontmatterUpdate) return null
  if (needsRename && fs.existsSync(nextPath)) {
    console.warn(`[skip] filename collision: ${nextFilename} (from ${path.basename(filePath)})`)
    return null
  }

  const updatedFrontmatter: Frontmatter = { ...frontmatter, url_slug: urlSlug }
  delete updatedFrontmatter['URL Slug']

  const nextContent = `${serializeFrontmatter(updatedFrontmatter)}\n${body}`

  if (!dryRun) {
    fs.writeFileSync(filePath, nextContent, 'utf-8')
    if (needsRename) {
      fs.renameSync(filePath, nextPath)
    }
  }

  return {
    file: needsRename ? nextPath : filePath,
    slug,
    urlSlug,
    renamedFrom: needsRename ? filePath : undefined
  }
}

function processDirectory(dir: string): UpdateResult[] {
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.md'))
  const results: UpdateResult[] = []

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const updated = updateFile(fullPath)
    if (updated) results.push(updated)
  }

  return results
}

const updatedDrafts = processDirectory(DRAFTS_DIR)
const updatedPublished = includePublished ? processDirectory(PUBLISHED_DIR) : []
const updated = [...updatedDrafts, ...updatedPublished]

const total = updated.length
const renamed = updated.filter(item => item.renamedFrom).length

console.log(`${dryRun ? '[dry-run] ' : ''}Updated ${total} file(s). Renamed ${renamed}.`)
for (const item of updated) {
  const label = item.renamedFrom ? `renamed -> ${item.file}` : item.file
  console.log(`- ${label}`)
  console.log(`  url_slug: ${item.urlSlug}`)
}
