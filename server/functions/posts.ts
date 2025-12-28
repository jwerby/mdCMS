import { createServerFn } from '@tanstack/react-start'
import { randomUUID } from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../lib/security/path-sanitizer'
import { postsCache, invalidateContentCache } from '../../lib/cache/file-cache'
import { parseFrontmatter, serializeFrontmatter } from '../../lib/markdown/frontmatter-parser'
import {
  getPostInputSchema,
  updatePostInputSchema,
  deletePostInputSchema,
  togglePublishInputSchema,
  createPostInputSchema,
  bulkActionInputSchema,
  validateInput
} from '../../lib/validation/schemas'

const isServer = typeof window === 'undefined'
const CONTENT_DIR = isServer ? path.join(process.cwd(), 'content') : ''
const PUBLISHED_DIR = isServer ? path.join(CONTENT_DIR, 'published') : ''
const DRAFTS_DIR = isServer ? path.join(CONTENT_DIR, 'drafts') : ''
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PostFrontmatter {
  article_id?: string  // UUID - immutable identifier
  title?: string
  description?: string
  meta_title?: string
  meta_description?: string
  primary_keyword?: string
  secondary_keywords?: string | string[]
  url_slug?: string
  published_date?: string
  thumbnail?: string
  schema_image?: string
  views?: number
  queue_article_id?: number
  'Meta Title'?: string
  'Meta Description'?: string
  'Primary Keyword'?: string
  'URL Slug'?: string
}

export interface Post {
  id: string  // UUID - immutable identifier
  slug: string
  filename: string
  title: string
  description: string
  directory: 'published' | 'drafts'
  content: string
  frontmatter: PostFrontmatter
  date: string
  thumbnail: string | null
  views: number
  createdAt: string
}

function getSlugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')
}

function isLikelyId(value: string): boolean {
  return UUID_REGEX.test(value) || value.startsWith('legacy-')
}

function findPostByIdentifier(
  identifier: string,
  published: Post[],
  drafts: Post[]
): { post: Post; dir: string } | null {
  if (isLikelyId(identifier)) {
    const byId = published.find(p => p.id === identifier) || drafts.find(p => p.id === identifier)
    if (byId) {
      return { post: byId, dir: byId.directory === 'published' ? PUBLISHED_DIR : DRAFTS_DIR }
    }
  }

  const bySlug = published.find(p => p.slug === identifier) || drafts.find(p => p.slug === identifier)
  if (bySlug) {
    return { post: bySlug, dir: bySlug.directory === 'published' ? PUBLISHED_DIR : DRAFTS_DIR }
  }

  return null
}

async function loadPostsFromDir(dir: string, directory: 'published' | 'drafts'): Promise<Post[]> {
  // Check cache first
  const cacheKey = `posts:${directory}`
  const cached = postsCache.get(cacheKey)
  if (cached) {
    return cached as Post[]
  }

  try {
    await fsp.access(dir)
  } catch {
    return []
  }

  const files = (await fsp.readdir(dir)).filter(f => f.endsWith('.md'))

  const posts = await Promise.all(files.map(async filename => {
    const filePath = path.join(dir, filename)
    const [stats, content] = await Promise.all([
      fsp.stat(filePath),
      fsp.readFile(filePath, 'utf-8')
    ])
    const { frontmatter, body: _ } = parseFrontmatter(content)

    const slugFromFrontmatter = (frontmatter.url_slug ?? frontmatter['URL Slug'])
      ?.replace(/^\/blog\//, '').replace(/^\//, '')
    const slug = slugFromFrontmatter ?? getSlugFromFilename(filename)

    const title = frontmatter.title ?? frontmatter.meta_title ?? frontmatter['Meta Title'] ?? slug
    const description = frontmatter.description ?? frontmatter.meta_description ?? frontmatter['Meta Description'] ?? ''

    let date = frontmatter.published_date
    if (!date) {
      const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/)
      date = dateMatch?.[1] ?? new Date().toISOString().split('T')[0]
    }

    // Get thumbnail from frontmatter (schema_image or thumbnail)
    const thumbnail = frontmatter.schema_image ?? frontmatter.thumbnail ?? null

    // Get views from frontmatter or default to 0
    const views = typeof frontmatter.views === 'number' ? frontmatter.views : 0

    // Get or generate article_id (UUID)
    // If no article_id exists, generate a deterministic one from filename for consistency
    // Real UUIDs will be assigned by migration script or createPost
    const id = frontmatter.article_id ?? `legacy-${filename.replace(/\.md$/, '')}`

    return {
      id,
      slug,
      filename,
      title,
      description,
      directory,
      content,
      frontmatter,
      date,
      thumbnail,
      views,
      createdAt: stats.birthtime.toISOString()
    }
  }))

  // Cache the result
  postsCache.set(cacheKey, posts)

  return posts
}

// Get all posts (for dashboard - includes drafts)
export const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const [published, drafts] = await Promise.all([
    loadPostsFromDir(PUBLISHED_DIR, 'published'),
    loadPostsFromDir(DRAFTS_DIR, 'drafts')
  ])
  const posts = [...published, ...drafts].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return posts
})

// Get published posts only (for public blog)
export const getPublishedPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const posts = await loadPostsFromDir(PUBLISHED_DIR, 'published')
  return posts.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

// Get single post
export const getPost = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getPostInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])
    const post = [...published, ...drafts].find(p => p.slug === sanitized.sanitized)

    if (!post) {
      throw new Error('Post not found')
    }
    return post
  })

// Get post by UUID (immutable identifier)
export const getPostById = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    const schema = z.object({ id: z.string().min(1) })
    return validateInput(schema, data)
  })
  .handler(async ({ data }) => {
    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])
    const post = [...published, ...drafts].find(p => p.id === data.id)

    if (!post) {
      throw new Error('Post not found')
    }
    return post
  })

// Toggle publish status
export const togglePublish = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(togglePublishInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])

    const match = findPostByIdentifier(sanitized.sanitized, published, drafts)
    if (!match) {
      throw new Error('Post not found')
    }

    const { post, dir } = match
    const isCurrentlyPublished = dir === PUBLISHED_DIR

    const sourceDir = isCurrentlyPublished ? PUBLISHED_DIR : DRAFTS_DIR
    const targetDir = isCurrentlyPublished ? DRAFTS_DIR : PUBLISHED_DIR
    const sourcePath = path.join(sourceDir, post.filename)
    const targetPath = path.join(targetDir, post.filename)

    // Verify paths are within content directory
    if (!isPathWithinBase(sourcePath, CONTENT_DIR) || !isPathWithinBase(targetPath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { sourcePath, targetPath })
      throw new Error('Invalid file path')
    }

    await fsp.rename(sourcePath, targetPath)

    // Invalidate cache
    invalidateContentCache('post')

    // Sync with SEO planner queue if this post is linked to a queue item
    const queueArticleId = post.frontmatter.queue_article_id
    if (queueArticleId) {
      try {
        const newQueueStatus = isCurrentlyPublished ? 'draft' : 'published'
        const { updateQueueItem } = await import('../../lib/seo-planner.server')
        updateQueueItem(queueArticleId, { status: newQueueStatus })
      } catch {
        // Don't fail the publish if queue sync fails
        console.warn(`Failed to sync queue item ${queueArticleId} status`)
      }
    }

    return {
      success: true,
      slug: post.slug,
      newStatus: isCurrentlyPublished ? 'drafts' : 'published' as const
    }
  })

// Update post content
export const updatePost = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(updatePostInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])

    const match = findPostByIdentifier(sanitized.sanitized, published, drafts)
    if (!match) {
      throw new Error('Post not found')
    }

    const { post, dir } = match

    const filePath = path.join(dir, post.filename)

    // Verify path is within content directory
    if (!isPathWithinBase(filePath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    let fileContent: string
    if ('frontmatter' in data && data.frontmatter) {
      const { body } = parseFrontmatter(data.content)
      fileContent = `${serializeFrontmatter(data.frontmatter as PostFrontmatter)}\n${body}`
    } else {
      fileContent = data.content
    }

    await fsp.writeFile(filePath, fileContent, 'utf-8')

    // Invalidate cache
    invalidateContentCache('post', post.slug)

    return { success: true, slug: post.slug }
  })

// Create new post
export const createPost = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(createPostInputSchema, data))
  .handler(async ({ data }) => {
    // Ensure drafts directory exists
    await fsp.mkdir(DRAFTS_DIR, { recursive: true })

    // Generate and sanitize slug from title
    const rawSlug = data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const sanitized = sanitizeSlug(rawSlug)
    if (!sanitized.isValid) {
      throw new Error('Could not generate valid slug from title')
    }

    const slug = sanitized.sanitized
    const date = new Date().toISOString().split('T')[0]
    const filename = `${slug}-${date}.md`
    const filePath = path.join(DRAFTS_DIR, filename)

    // Verify path is within content directory
    if (!isPathWithinBase(filePath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    try {
      await fsp.access(filePath)
      throw new Error('Post with this title already exists')
    } catch (err) {
      // File doesn't exist, which is what we want
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }

    // Generate a UUID for the new article
    const articleId = randomUUID()

    const fm = {
      article_id: articleId,
      meta_title: data.title,
      url_slug: `/blog/${slug}`,
      published_date: date
    }

    const body = data.content ?? `# ${data.title}\n\nStart writing your post here...`
    const fileContent = `${serializeFrontmatter(fm)}\n${body}`

    await fsp.writeFile(filePath, fileContent, 'utf-8')

    // Invalidate cache
    invalidateContentCache('post')

    return { success: true, slug, filename, id: articleId }
  })

// Delete post
export const deletePost = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(deletePostInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])

    const match = findPostByIdentifier(sanitized.sanitized, published, drafts)
    if (!match) {
      throw new Error('Post not found')
    }

    const { post, dir } = match

    const filePath = path.join(dir, post.filename)

    // Verify path is within content directory
    if (!isPathWithinBase(filePath, CONTENT_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    await fsp.unlink(filePath)

    // Invalidate cache
    invalidateContentCache('post')

    return { success: true, slug: post.slug }
  })

// Bulk publish posts
export const bulkPublish = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(bulkActionInputSchema, data))
  .handler(async ({ data }) => {
    const drafts = await loadPostsFromDir(DRAFTS_DIR, 'drafts')
    const results: { slug: string; success: boolean; error?: string }[] = []

    for (const slug of data.slugs) {
      // Sanitize each slug
      const sanitized = sanitizeSlug(slug)
      if (!sanitized.isValid) {
        logSecurityEvent('invalid_slug', { slug, error: sanitized.error })
        results.push({ slug, success: false, error: 'Invalid slug' })
        continue
      }

      const post = drafts.find(p => p.slug === sanitized.sanitized)
      if (!post) {
        results.push({ slug: sanitized.sanitized, success: false, error: 'Not found or already published' })
        continue
      }

      try {
        const sourcePath = path.join(DRAFTS_DIR, post.filename)
        const targetPath = path.join(PUBLISHED_DIR, post.filename)

        // Verify paths are within content directory
        if (!isPathWithinBase(sourcePath, CONTENT_DIR) || !isPathWithinBase(targetPath, CONTENT_DIR)) {
          logSecurityEvent('path_escape_attempt', { sourcePath, targetPath })
          results.push({ slug: sanitized.sanitized, success: false, error: 'Invalid file path' })
          continue
        }

        await fsp.rename(sourcePath, targetPath)
        results.push({ slug: sanitized.sanitized, success: true })
      } catch (err) {
        results.push({ slug: sanitized.sanitized, success: false, error: String(err) })
      }
    }

    // Invalidate cache if any successful
    if (results.some(r => r.success)) {
      invalidateContentCache('post')
    }

    return { results, published: results.filter(r => r.success).length }
  })

// Bulk unpublish (move to drafts)
export const bulkUnpublish = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(bulkActionInputSchema, data))
  .handler(async ({ data }) => {
    const published = await loadPostsFromDir(PUBLISHED_DIR, 'published')
    const results: { slug: string; success: boolean; error?: string }[] = []

    for (const slug of data.slugs) {
      // Sanitize each slug
      const sanitized = sanitizeSlug(slug)
      if (!sanitized.isValid) {
        logSecurityEvent('invalid_slug', { slug, error: sanitized.error })
        results.push({ slug, success: false, error: 'Invalid slug' })
        continue
      }

      const post = published.find(p => p.slug === sanitized.sanitized)
      if (!post) {
        results.push({ slug: sanitized.sanitized, success: false, error: 'Not found or already draft' })
        continue
      }

      try {
        const sourcePath = path.join(PUBLISHED_DIR, post.filename)
        const targetPath = path.join(DRAFTS_DIR, post.filename)

        // Verify paths are within content directory
        if (!isPathWithinBase(sourcePath, CONTENT_DIR) || !isPathWithinBase(targetPath, CONTENT_DIR)) {
          logSecurityEvent('path_escape_attempt', { sourcePath, targetPath })
          results.push({ slug: sanitized.sanitized, success: false, error: 'Invalid file path' })
          continue
        }

        await fsp.rename(sourcePath, targetPath)
        results.push({ slug: sanitized.sanitized, success: true })
      } catch (err) {
        results.push({ slug: sanitized.sanitized, success: false, error: String(err) })
      }
    }

    // Invalidate cache if any successful
    if (results.some(r => r.success)) {
      invalidateContentCache('post')
    }

    return { results, unpublished: results.filter(r => r.success).length }
  })

// Bulk delete posts
export const bulkDelete = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(bulkActionInputSchema, data))
  .handler(async ({ data }) => {
    const [published, drafts] = await Promise.all([
      loadPostsFromDir(PUBLISHED_DIR, 'published'),
      loadPostsFromDir(DRAFTS_DIR, 'drafts')
    ])
    const results: { slug: string; success: boolean; error?: string }[] = []

    for (const slug of data.slugs) {
      // Sanitize each slug
      const sanitized = sanitizeSlug(slug)
      if (!sanitized.isValid) {
        logSecurityEvent('invalid_slug', { slug, error: sanitized.error })
        results.push({ slug, success: false, error: 'Invalid slug' })
        continue
      }

      let post = published.find(p => p.slug === sanitized.sanitized)
      let dir = PUBLISHED_DIR

      if (!post) {
        post = drafts.find(p => p.slug === sanitized.sanitized)
        dir = DRAFTS_DIR
      }

      if (!post) {
        results.push({ slug: sanitized.sanitized, success: false, error: 'Not found' })
        continue
      }

      try {
        const filePath = path.join(dir, post.filename)

        // Verify path is within content directory
        if (!isPathWithinBase(filePath, CONTENT_DIR)) {
          logSecurityEvent('path_escape_attempt', { filePath })
          results.push({ slug: sanitized.sanitized, success: false, error: 'Invalid file path' })
          continue
        }

        await fsp.unlink(filePath)
        results.push({ slug: sanitized.sanitized, success: true })
      } catch (err) {
        results.push({ slug: sanitized.sanitized, success: false, error: String(err) })
      }
    }

    // Invalidate cache if any successful
    if (results.some(r => r.success)) {
      invalidateContentCache('post')
    }

    return { results, deleted: results.filter(r => r.success).length }
  })
