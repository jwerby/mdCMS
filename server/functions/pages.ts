import { createServerFn } from '@tanstack/react-start'
import fsp from 'fs/promises'
import path from 'path'
import { sanitizeSlug, isPathWithinBase, logSecurityEvent } from '../../lib/security/path-sanitizer'
import { pagesCache, invalidateContentCache } from '../../lib/cache/file-cache'
import { parseFrontmatter, serializeFrontmatter } from '../../lib/markdown/frontmatter-parser'
import {
  getPageInputSchema,
  updatePageInputSchema,
  deletePageInputSchema,
  createPageInputSchema,
  validateInput
} from '../../lib/validation/schemas'

const PAGES_DIR = path.join(process.cwd(), 'content', 'pages')

export interface EnhanceConfig {
  hero?: {
    enabled: boolean
    source?: string
    style?: string
    gradient?: string
    textColor?: string
    includeSubtitle?: boolean
    includeButtons?: boolean
    minHeight?: string
    texture?: string
    backgroundImage?: string
    backgroundOverlay?: string
    overlayImage?: string
    overlayOpacity?: number
    // Bottom edge styles
    bottomStyle?: 'none' | 'wave' | 'angle' | 'angle-left' | 'curve' | 'fade'
    bottomHeight?: number
    // Grain texture
    showGrain?: boolean
    grainOpacity?: number
  }
  enhancements?: Array<{
    target: string
    type: string
    style?: string
    includeChildren?: boolean
    columns?: number
    background?: string
    textColor?: string
    buttonStyle?: string
    icons?: Record<string, string>
  }>
  footer?: {
    copyright?: string
    showContact?: boolean
  }
}

interface PageFrontmatter {
  title?: string
  description?: string
  meta_title?: string
  meta_description?: string
  template?: string
  order?: number
  show_in_nav?: boolean
  nav_label?: string
}

export interface Page {
  slug: string
  filename: string
  title: string
  description: string
  content: string
  frontmatter: PageFrontmatter
  template: string
  order: number
  showInNav: boolean
  navLabel: string
}

async function ensurePagesDir(): Promise<void> {
  try {
    await fsp.access(PAGES_DIR)
  } catch {
    await fsp.mkdir(PAGES_DIR, { recursive: true })
  }
}

async function loadPage(filename: string): Promise<Page> {
  const filePath = path.join(PAGES_DIR, filename)
  const content = await fsp.readFile(filePath, 'utf-8')
  const { frontmatter } = parseFrontmatter(content)

  const slug = filename.replace(/\.md$/, '')
  const title = frontmatter.title ?? frontmatter.meta_title ?? slug
  const description = frontmatter.description ?? frontmatter.meta_description ?? ''

  return {
    slug,
    filename,
    title,
    description,
    content,
    frontmatter,
    template: frontmatter.template ?? 'default',
    order: frontmatter.order ?? 0,
    showInNav: frontmatter.show_in_nav ?? false,
    navLabel: frontmatter.nav_label ?? title
  }
}

async function loadEnhanceConfig(slug: string): Promise<EnhanceConfig | null> {
  const enhancePath = path.join(PAGES_DIR, `${slug}.enhance.json`)
  try {
    const content = await fsp.readFile(enhancePath, 'utf-8')
    return JSON.parse(content) as EnhanceConfig
  } catch {
    return null
  }
}

async function loadAllPages(): Promise<Page[]> {
  const cacheKey = 'pages:all'
  const cached = pagesCache.get(cacheKey)
  if (cached) return cached as Page[]

  await ensurePagesDir()
  const files = (await fsp.readdir(PAGES_DIR)).filter(f => f.endsWith('.md'))
  const pages = await Promise.all(files.map(loadPage))
  const sorted = pages.sort((a, b) => a.order - b.order)

  pagesCache.set(cacheKey, sorted)
  return sorted
}

// Get all pages
export const getPages = createServerFn({ method: 'GET' }).handler(async () => {
  return loadAllPages()
})

// Get single page by slug
export const getPage = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getPageInputSchema, data))
  .handler(async ({ data }) => {
    await ensurePagesDir()

    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    // Check cache first
    const cacheKey = `page:${sanitized.sanitized}`
    const cached = pagesCache.get(cacheKey)
    if (cached) return cached as Page

    const filename = `${sanitized.sanitized}.md`
    const filePath = path.join(PAGES_DIR, filename)

    // Verify path is within pages directory
    if (!isPathWithinBase(filePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    try {
      await fsp.access(filePath)
    } catch {
      throw new Error('Page not found')
    }

    const page = await loadPage(filename)
    pagesCache.set(cacheKey, page)
    return page
  })

// Get page with enhancement config
export const getPageWithEnhancements = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getPageInputSchema, data))
  .handler(async ({ data }) => {
    await ensurePagesDir()

    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const filename = `${sanitized.sanitized}.md`
    const filePath = path.join(PAGES_DIR, filename)

    // Verify path is within pages directory
    if (!isPathWithinBase(filePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    try {
      await fsp.access(filePath)
    } catch {
      throw new Error('Page not found')
    }

    // Load page and enhance config in parallel
    const [page, enhanceConfig] = await Promise.all([
      loadPage(filename),
      loadEnhanceConfig(sanitized.sanitized)
    ])

    return { page, enhanceConfig }
  })

// Create new page
export const createPage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(createPageInputSchema, data))
  .handler(async ({ data }) => {
    await ensurePagesDir()

    // Generate and sanitize slug from title
    const rawSlug = data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const sanitized = sanitizeSlug(rawSlug)
    if (!sanitized.isValid) {
      throw new Error('Could not generate valid slug from title')
    }

    const slug = sanitized.sanitized
    const filename = `${slug}.md`
    const filePath = path.join(PAGES_DIR, filename)

    // Verify path is within pages directory
    if (!isPathWithinBase(filePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    // Check if file already exists
    try {
      await fsp.access(filePath)
      throw new Error('Page with this slug already exists')
    } catch (e) {
      if ((e as Error).message === 'Page with this slug already exists') {
        throw e
      }
      // File doesn't exist, continue
    }

    const fm = {
      title: data.title,
      meta_title: data.title,
      show_in_nav: false,
      order: 0
    }

    const body = `# ${data.title}\n\nStart writing your page here...`
    const fileContent = `${serializeFrontmatter(fm)}\n${body}`

    await fsp.writeFile(filePath, fileContent, 'utf-8')

    // Invalidate pages cache
    invalidateContentCache('page')

    return { success: true, slug, filename }
  })

// Update page
export const updatePage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(updatePageInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const filename = `${sanitized.sanitized}.md`
    const filePath = path.join(PAGES_DIR, filename)

    // Verify path is within pages directory
    if (!isPathWithinBase(filePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    try {
      await fsp.access(filePath)
    } catch {
      throw new Error('Page not found')
    }

    let fileContent: string
    if ('frontmatter' in data && data.frontmatter) {
      const { body } = parseFrontmatter(data.content)
      fileContent = `${serializeFrontmatter(data.frontmatter as PageFrontmatter)}\n${body}`
    } else {
      fileContent = data.content
    }

    await fsp.writeFile(filePath, fileContent, 'utf-8')

    // Invalidate cache for this specific page and the pages list
    invalidateContentCache('page', sanitized.sanitized)

    return { success: true, slug: sanitized.sanitized }
  })

// Delete page
export const deletePage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(deletePageInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const filename = `${sanitized.sanitized}.md`
    const filePath = path.join(PAGES_DIR, filename)

    // Verify path is within pages directory
    if (!isPathWithinBase(filePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    try {
      await fsp.access(filePath)
    } catch {
      throw new Error('Page not found')
    }

    await fsp.unlink(filePath)

    // Also delete enhance config if it exists
    const enhancePath = path.join(PAGES_DIR, `${sanitized.sanitized}.enhance.json`)
    try {
      await fsp.unlink(enhancePath)
    } catch {
      // Enhance config doesn't exist, that's fine
    }

    // Invalidate cache
    invalidateContentCache('page', sanitized.sanitized)

    return { success: true, slug: sanitized.sanitized }
  })

// Save enhance config for a page
export const saveEnhanceConfig = createServerFn({ method: 'POST' })
  .inputValidator((data: { slug: string; config: EnhanceConfig | null }) => {
    if (!data.slug || typeof data.slug !== 'string') {
      throw new Error('Slug is required')
    }
    return data
  })
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    const enhancePath = path.join(PAGES_DIR, `${sanitized.sanitized}.enhance.json`)

    // Verify path is within pages directory
    if (!isPathWithinBase(enhancePath, PAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { enhancePath })
      throw new Error('Invalid file path')
    }

    if (data.config === null) {
      // Delete enhance config if it exists
      try {
        await fsp.unlink(enhancePath)
      } catch {
        // File doesn't exist, that's fine
      }
      return { success: true, slug: sanitized.sanitized }
    }

    // Save enhance config
    await fsp.writeFile(enhancePath, JSON.stringify(data.config, null, 2), 'utf-8')
    return { success: true, slug: sanitized.sanitized }
  })

// Get enhance config for a page (separate from page content)
export const getEnhanceConfig = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => validateInput(getPageInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the slug
    const sanitized = sanitizeSlug(data.slug)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_slug', { slug: data.slug, error: sanitized.error })
      throw new Error('Invalid slug')
    }

    return await loadEnhanceConfig(sanitized.sanitized)
  })
