import fs from 'fs'
import path from 'path'
import { parseFrontmatter } from '../../lib/markdown/frontmatter-parser'

export interface PostFileMatch {
  file: string
  filePath: string
  content: string
  frontmatter: Record<string, unknown>
  slug: string
  articleId?: string
}

function normalizeSlug(input: string): string {
  return input.replace(/^\/blog\//, '').replace(/^\//, '')
}

function getSlugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')
}

function getSlugFromFrontmatter(frontmatter: Record<string, unknown>): string {
  const raw = frontmatter.url_slug ?? frontmatter['URL Slug'] ?? ''
  return typeof raw === 'string' ? normalizeSlug(raw.trim()) : ''
}

function getArticleId(frontmatter: Record<string, unknown>): string {
  const raw = frontmatter.article_id
  return typeof raw === 'string' ? raw.trim() : ''
}

export function findPostFileByIdentifier(dir: string, identifier: string): PostFileMatch | null {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.md'))
  const normalized = normalizeSlug(identifier)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content)
    const articleId = getArticleId(frontmatter)
    if (articleId && articleId === identifier) {
      return {
        file,
        filePath,
        content,
        frontmatter,
        slug: getSlugFromFrontmatter(frontmatter) || getSlugFromFilename(file),
        articleId
      }
    }

    const slug = getSlugFromFrontmatter(frontmatter) || getSlugFromFilename(file)
    if (slug === normalized) {
      return {
        file,
        filePath,
        content,
        frontmatter,
        slug,
        articleId: articleId || undefined
      }
    }
  }

  return null
}
