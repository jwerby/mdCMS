import { createServerFn } from '@tanstack/react-start'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { z } from 'zod'
import { validateInput } from '../../lib/validation/schemas'
import { isPathWithinBase } from '../../lib/security/path-sanitizer'
import {
  generateFeaturedImage,
  generateInlineImage,
  generateImageOptions,
  analyzeImage,
  generateAltTextFromContext,
  type ImageStyle,
  type ImageAnalysis,
} from './ai/image-generation'
import {
  createMedia,
  searchMedia,
  updateMedia,
  deleteMedia,
  getMediaStats,
  mediaExists,
  type MediaSearchOptions,
} from '../../lib/media.server'

const IMAGES_DIR = path.join(process.cwd(), 'content', 'images')
const AI_IMAGES_DIR = path.join(IMAGES_DIR, 'ai-generated')

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(AI_IMAGES_DIR)) {
    fs.mkdirSync(AI_IMAGES_DIR, { recursive: true })
  }
}

// Convert text to SEO-friendly slug
function slugify(text: string, maxLength: number = 50): string {
  return text
    .toLowerCase()
    .trim()
    // Remove common filler words for cleaner slugs
    .replace(/\b(a|an|the|and|or|but|in|on|at|to|for|of|with|by|from|as|is|was|are|were|been|be|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|dare|ought|used|going)\b/gi, '')
    // Replace special characters and spaces with hyphens
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, maxLength)
    // Don't end with a hyphen after truncation
    .replace(/-+$/, '')
}

// Generate an SEO-optimized unique filename
function generateSeoFilename(text: string, prefix: string = 'image'): string {
  const slug = slugify(text)
  const random = Math.random().toString(36).substring(2, 6) // Short 4-char suffix for uniqueness

  if (slug) {
    return `${slug}-${prefix}-${random}.webp`
  }
  // Fallback if slugify produces empty string
  return `${prefix}-${random}.webp`
}

interface SavedImageResult {
  url: string
  fileSize: number
  width: number
  height: number
}

// Save base64 image to disk, converting to WebP for optimization
async function saveBase64Image(base64: string, filename: string): Promise<SavedImageResult> {
  ensureDirectories()

  const inputBuffer = Buffer.from(base64, 'base64')

  // Convert to WebP for smaller file size and get metadata
  const image = sharp(inputBuffer)
  const metadata = await image.metadata()
  const webpBuffer = await image.webp({ quality: 85 }).toBuffer()

  const filePath = path.join(AI_IMAGES_DIR, filename)

  if (!isPathWithinBase(filePath, IMAGES_DIR)) {
    throw new Error('Invalid file path')
  }

  fs.writeFileSync(filePath, webpBuffer)

  return {
    url: `/content/images/ai-generated/${filename}`,
    fileSize: webpBuffer.length,
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
}

// Schema for featured image generation
const generateFeaturedImageSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  save: z.boolean().optional().default(true),
})

// Generate featured image for a blog post
export const generatePostFeaturedImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(generateFeaturedImageSchema, data))
  .handler(async ({ data }) => {
    const result = await generateFeaturedImage(
      data.title,
      data.description,
      data.category
    )

    // Generate AI alt text based on the content context
    const altText = await generateAltTextFromContext(
      data.title,
      data.description,
      data.category
    )

    if (data.save) {
      const filename = generateSeoFilename(data.title, 'featured')
      const saved = await saveBase64Image(result.base64, filename)

      // Save to media database
      createMedia({
        filename,
        url: saved.url,
        source: 'ai-generated',
        mimeType: 'image/webp',
        fileSize: saved.fileSize,
        width: saved.width,
        height: saved.height,
        altText,
        description: data.description,
        keywords: data.category ? [data.category] : [],
      })

      return {
        success: true,
        url: saved.url,
        filename,
        altText,
        mimeType: 'image/webp',
        markdown: `![${altText}](${saved.url})`,
      }
    }

    // Return base64 for preview without saving
    return {
      success: true,
      base64: result.base64,
      altText,
      mimeType: result.mimeType,
    }
  })

// Schema for inline image generation
const generateInlineImageSchema = z.object({
  context: z.string().min(1).max(1000),
  style: z.enum(['photorealistic', 'illustration', 'digital-art', 'minimalist', 'abstract']).optional(),
  save: z.boolean().optional().default(true),
})

// Generate inline image based on context/selection
export const generatePostInlineImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(generateInlineImageSchema, data))
  .handler(async ({ data }) => {
    const result = await generateInlineImage(
      data.context,
      data.style as ImageStyle
    )

    const altText = data.context.substring(0, 125)

    if (data.save) {
      const filename = generateSeoFilename(data.context, 'inline')
      const saved = await saveBase64Image(result.base64, filename)

      // Save to media database
      createMedia({
        filename,
        url: saved.url,
        source: 'ai-generated',
        mimeType: 'image/webp',
        fileSize: saved.fileSize,
        width: saved.width,
        height: saved.height,
        altText,
        description: data.context,
        keywords: data.style ? [data.style] : [],
      })

      return {
        success: true,
        url: saved.url,
        filename,
        altText,
        mimeType: 'image/webp',
        markdown: `![${altText}](${saved.url})`,
      }
    }

    return {
      success: true,
      base64: result.base64,
      altText,
      mimeType: result.mimeType,
    }
  })

// Schema for generating multiple options
const generateImageOptionsSchema = z.object({
  prompt: z.string().min(1).max(1000),
  count: z.number().min(1).max(4).optional().default(3),
})

// Generate multiple image options for user to choose from
export const generateImageVariants = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(generateImageOptionsSchema, data))
  .handler(async ({ data }) => {
    const results = await generateImageOptions(data.prompt, data.count)

    return {
      success: true,
      images: results.map((result, index) => ({
        index,
        base64: result.base64,
        mimeType: result.mimeType,
        style: ['photorealistic', 'illustration', 'digital-art'][index],
      })),
    }
  })

// Schema for saving a selected image
const saveGeneratedImageSchema = z.object({
  base64: z.string().min(1),
  prefix: z.string().max(50).optional().default('image'),
  altText: z.string().max(500).optional(),
  title: z.string().max(500).optional(), // Used for SEO-friendly filename
})

// Save a previously generated image (from preview/variants)
export const saveGeneratedImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(saveGeneratedImageSchema, data))
  .handler(async ({ data }) => {
    // Use title for SEO-friendly filename, fallback to altText, then prefix
    const nameSource = data.title || data.altText || data.prefix || 'image'
    const filename = generateSeoFilename(nameSource, data.prefix || 'image')
    const saved = await saveBase64Image(data.base64, filename)
    const altText = data.altText || 'AI generated image'

    // Save to media database
    createMedia({
      filename,
      url: saved.url,
      source: 'ai-generated',
      mimeType: 'image/webp',
      fileSize: saved.fileSize,
      width: saved.width,
      height: saved.height,
      altText,
      description: data.title,
    })

    return {
      success: true,
      url: saved.url,
      filename,
      altText,
      mimeType: 'image/webp',
      markdown: `![${altText}](${saved.url})`,
    }
  })

// Get all AI-generated images
export const getAIGeneratedImages = createServerFn({ method: 'GET' }).handler(async () => {
  ensureDirectories()

  if (!fs.existsSync(AI_IMAGES_DIR)) {
    return []
  }

  const files = fs.readdirSync(AI_IMAGES_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .map(filename => {
      const stats = fs.statSync(path.join(AI_IMAGES_DIR, filename))
      return {
        filename,
        url: `/content/images/ai-generated/${filename}`,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return files
})

// Uploads directory for user-uploaded images
const UPLOADS_DIR = path.join(IMAGES_DIR, 'uploads')

function ensureUploadsDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

// Schema for image upload
const uploadImageSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
  originalFilename: z.string().max(255).optional(),
  context: z.string().max(500).optional(), // Optional context to help AI analysis
})

// Upload an image: converts to WebP, generates AI alt text and SEO filename
export const uploadImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(uploadImageSchema, data))
  .handler(async ({ data }) => {
    ensureUploadsDirectory()

    // Decode base64 to buffer
    const inputBuffer = Buffer.from(data.base64, 'base64')

    // Analyze image with AI to get alt text and SEO filename
    let analysis: ImageAnalysis
    try {
      analysis = await analyzeImage(data.base64, data.mimeType, data.context)
    } catch (err) {
      // Fallback if AI analysis fails
      const fallbackName = data.originalFilename
        ? path.basename(data.originalFilename, path.extname(data.originalFilename))
        : 'uploaded-image'
      analysis = {
        altText: data.context || fallbackName,
        seoFilename: fallbackName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: '',
        keywords: [],
      }
    }

    // Convert to WebP with sharp and get metadata
    const image = sharp(inputBuffer)
    const metadata = await image.metadata()
    const webpBuffer = await image.webp({ quality: 85 }).toBuffer()

    // Generate SEO-friendly filename
    const random = Math.random().toString(36).substring(2, 6)
    const filename = `${analysis.seoFilename}-${random}.webp`
    const filePath = path.join(UPLOADS_DIR, filename)

    if (!isPathWithinBase(filePath, IMAGES_DIR)) {
      throw new Error('Invalid file path')
    }

    // Save the WebP image
    fs.writeFileSync(filePath, webpBuffer)
    const url = `/content/images/uploads/${filename}`

    // Save to media database
    createMedia({
      filename,
      url,
      source: 'upload',
      mimeType: 'image/webp',
      fileSize: webpBuffer.length,
      width: metadata.width || 0,
      height: metadata.height || 0,
      altText: analysis.altText,
      description: analysis.description,
      keywords: analysis.keywords,
      originalFilename: data.originalFilename,
    })

    return {
      success: true,
      url,
      filename,
      altText: analysis.altText,
      description: analysis.description,
      keywords: analysis.keywords,
      mimeType: 'image/webp',
      originalSize: inputBuffer.length,
      optimizedSize: webpBuffer.length,
      markdown: `![${analysis.altText}](${url})`,
    }
  })

// Get all uploaded images
export const getUploadedImages = createServerFn({ method: 'GET' }).handler(async () => {
  ensureUploadsDirectory()

  if (!fs.existsSync(UPLOADS_DIR)) {
    return []
  }

  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    .map(filename => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, filename))
      return {
        filename,
        url: `/content/images/uploads/${filename}`,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return files
})

// ============================================
// Unified Media Manager API
// ============================================

// Schema for media search
const searchMediaSchema = z.object({
  query: z.string().max(200).optional(),
  source: z.enum(['upload', 'ai-generated', 'manual', 'all']).optional().default('all'),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['created_at', 'filename', 'file_size']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

// Search and list all media
export const getAllMedia = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(searchMediaSchema, data))
  .handler(async ({ data }) => {
    const result = searchMedia({
      query: data.query,
      source: data.source,
      limit: data.limit,
      offset: data.offset,
      sortBy: data.sortBy,
      sortOrder: data.sortOrder,
    })

    return {
      success: true,
      items: result.items,
      total: result.total,
      limit: data.limit,
      offset: data.offset,
    }
  })

// Schema for updating media metadata
const updateMediaMetadataSchema = z.object({
  id: z.number().int().positive(),
  altText: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  keywords: z.array(z.string().max(50)).max(10).optional(),
})

// Update media metadata
export const updateMediaMetadata = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(updateMediaMetadataSchema, data))
  .handler(async ({ data }) => {
    const updated = updateMedia(data.id, {
      altText: data.altText,
      description: data.description,
      keywords: data.keywords,
    })

    if (!updated) {
      throw new Error('Media item not found')
    }

    return {
      success: true,
      item: updated,
    }
  })

// Schema for deleting media
const deleteMediaSchema = z.object({
  id: z.number().int().positive(),
  deleteFile: z.boolean().optional().default(true),
})

// Delete media
export const deleteMediaItem = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(deleteMediaSchema, data))
  .handler(async ({ data }) => {
    // Get the media item to find the file path
    const { items } = searchMedia({ limit: 1, offset: 0 })
    const item = items.find(i => i.id === data.id)

    if (!item) {
      throw new Error('Media item not found')
    }

    // Delete from database
    const deleted = deleteMedia(data.id)

    // Optionally delete the file
    if (data.deleteFile && deleted) {
      const filePath = path.join(process.cwd(), item.url)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    return {
      success: deleted,
    }
  })

// Get media library statistics
export const getMediaLibraryStats = createServerFn({ method: 'GET' }).handler(async () => {
  const stats = getMediaStats()

  return {
    success: true,
    total: stats.total,
    bySource: stats.bySource,
    totalSize: stats.totalSize,
    totalSizeFormatted: formatBytes(stats.totalSize),
  }
})

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Sync existing files to database (for migration)
export const syncMediaToDatabase = createServerFn({ method: 'POST' }).handler(async () => {
  const synced = { aiGenerated: 0, uploads: 0, manual: 0 }

  // Sync AI-generated images
  ensureDirectories()
  if (fs.existsSync(AI_IMAGES_DIR)) {
    const aiFiles = fs.readdirSync(AI_IMAGES_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    for (const filename of aiFiles) {
      if (!mediaExists(filename)) {
        const filePath = path.join(AI_IMAGES_DIR, filename)
        const stats = fs.statSync(filePath)
        const buffer = fs.readFileSync(filePath)
        const metadata = await sharp(buffer).metadata()

        createMedia({
          filename,
          url: `/content/images/ai-generated/${filename}`,
          source: 'ai-generated',
          mimeType: 'image/webp',
          fileSize: stats.size,
          width: metadata.width,
          height: metadata.height,
        })
        synced.aiGenerated++
      }
    }
  }

  // Sync uploaded images
  ensureUploadsDirectory()
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadFiles = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    for (const filename of uploadFiles) {
      if (!mediaExists(filename)) {
        const filePath = path.join(UPLOADS_DIR, filename)
        const stats = fs.statSync(filePath)
        const buffer = fs.readFileSync(filePath)
        const metadata = await sharp(buffer).metadata()

        createMedia({
          filename,
          url: `/content/images/uploads/${filename}`,
          source: 'upload',
          mimeType: `image/${path.extname(filename).slice(1)}`,
          fileSize: stats.size,
          width: metadata.width,
          height: metadata.height,
        })
        synced.uploads++
      }
    }
  }

  // Sync manual images (root images folder)
  const MANUAL_DIR = path.join(IMAGES_DIR)
  const manualFiles = fs.readdirSync(MANUAL_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    .filter(f => !fs.statSync(path.join(MANUAL_DIR, f)).isDirectory())
  for (const filename of manualFiles) {
    if (!mediaExists(filename)) {
      const filePath = path.join(MANUAL_DIR, filename)
      const stats = fs.statSync(filePath)
      const buffer = fs.readFileSync(filePath)
      const metadata = await sharp(buffer).metadata()

      createMedia({
        filename,
        url: `/content/images/${filename}`,
        source: 'manual',
        mimeType: `image/${path.extname(filename).slice(1)}`,
        fileSize: stats.size,
        width: metadata.width,
        height: metadata.height,
      })
      synced.manual++
    }
  }

  return {
    success: true,
    synced,
    message: `Synced ${synced.aiGenerated} AI-generated, ${synced.uploads} uploaded, ${synced.manual} manual images`,
  }
})
