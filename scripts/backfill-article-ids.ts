import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { parseFrontmatter, serializeFrontmatter } from '../lib/markdown/frontmatter-parser'

type Frontmatter = Record<string, unknown>

const ROOT_DIR = process.cwd()
const DRAFTS_DIR = path.join(ROOT_DIR, 'content', 'drafts')
const PUBLISHED_DIR = path.join(ROOT_DIR, 'content', 'published')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const includePublished = args.has('--include-published')

type UpdateResult = {
  file: string
  id: string
}

function updateFile(filePath: string): UpdateResult | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter<Frontmatter>(content)

  const existingId = typeof frontmatter.article_id === 'string' ? frontmatter.article_id.trim() : ''
  if (existingId) return null

  const articleId = randomUUID()
  const updatedFrontmatter = { ...frontmatter, article_id: articleId }
  const nextContent = `${serializeFrontmatter(updatedFrontmatter)}\n${body}`

  if (!dryRun) {
    fs.writeFileSync(filePath, nextContent, 'utf-8')
  }

  return { file: filePath, id: articleId }
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

console.log(`${dryRun ? '[dry-run] ' : ''}Added article_id to ${updated.length} file(s).`)
for (const item of updated) {
  console.log(`- ${item.file} -> ${item.id}`)
}
