import { z } from 'zod'

/**
 * Zod validation schemas for all server function inputs
 * Provides type-safe validation with helpful error messages
 */

// ============================================
// Common Schemas
// ============================================

/**
 * Safe slug pattern - alphanumeric with hyphens and underscores
 * No path traversal characters allowed
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(200, 'Slug too long (max 200 characters)')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
    'Slug must start with alphanumeric and contain only letters, numbers, hyphens, and underscores'
  )
  .refine(
    (val) => !val.includes('..'),
    'Slug cannot contain path traversal sequences'
  )

/**
 * Safe filename pattern - allows dots for extensions
 */
export const filenameSchema = z
  .string()
  .min(1, 'Filename is required')
  .max(255, 'Filename too long (max 255 characters)')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'Filename must start with alphanumeric and contain only safe characters'
  )
  .refine(
    (val) => !val.startsWith('.'),
    'Hidden files not allowed'
  )
  .refine(
    (val) => !val.includes('..'),
    'Filename cannot contain path traversal sequences'
  )

/**
 * Directory type for posts
 */
export const directorySchema = z.enum(['published', 'drafts'])

// ============================================
// Content Schemas
// ============================================

/**
 * Maximum content size: 1MB
 */
const MAX_CONTENT_SIZE = 1024 * 1024

export const contentSchema = z
  .string()
  .max(MAX_CONTENT_SIZE, `Content too large (max ${MAX_CONTENT_SIZE / 1024}KB)`)

/**
 * Post content with frontmatter validation
 */
export const postContentSchema = z
  .string()
  .min(1, 'Content is required')
  .max(MAX_CONTENT_SIZE, `Content too large (max ${MAX_CONTENT_SIZE / 1024}KB)`)

/**
 * Frontmatter fields
 */
export const frontmatterSchema = z.object({
  meta_title: z.string().max(70, 'Meta title should be under 70 characters').optional(),
  meta_description: z.string().max(160, 'Meta description should be under 160 characters').optional(),
  primary_keyword: z.string().max(100).optional(),
  secondary_keywords: z.string().max(500).optional(),
  url_slug: z.string().max(200).optional(),
  published_date: z.string().optional(),
})

// ============================================
// Posts Schemas
// ============================================

export const getPostInputSchema = z.object({
  slug: slugSchema,
})

export const updatePostInputSchema = z.object({
  slug: slugSchema,
  content: postContentSchema,
})

export const deletePostInputSchema = z.object({
  slug: slugSchema,
})

export const togglePublishInputSchema = z.object({
  slug: slugSchema,
})

export const createPostInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: postContentSchema.optional(),
})

export const bulkActionInputSchema = z.object({
  slugs: z.array(slugSchema).min(1, 'At least one slug required').max(100, 'Too many items'),
})

// ============================================
// Pages Schemas
// ============================================

export const getPageInputSchema = z.object({
  slug: slugSchema,
})

export const updatePageInputSchema = z.object({
  slug: slugSchema,
  content: postContentSchema,
})

export const deletePageInputSchema = z.object({
  slug: slugSchema,
})

export const createPageInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
})

// ============================================
// History Schemas
// ============================================

export const historyTypeSchema = z.enum(['post', 'page'])

export const getVersionHistoryInputSchema = z.object({
  type: historyTypeSchema,
  slug: slugSchema,
})

export const getVersionInputSchema = z.object({
  type: historyTypeSchema,
  slug: slugSchema,
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid timestamp format'),
})

export const saveVersionInputSchema = z.object({
  type: historyTypeSchema,
  slug: slugSchema,
  content: postContentSchema,
})

// ============================================
// Image Schemas
// ============================================

/**
 * Maximum image size: 10MB
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export const allowedImageTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const imageUploadSchema = z.object({
  filename: filenameSchema,
  contentType: z.enum(allowedImageTypes, {
    errorMap: () => ({ message: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP, HEIC' }),
  }),
  size: z
    .number()
    .positive()
    .max(MAX_IMAGE_SIZE, `Image too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`),
  data: z.string(), // Base64 encoded
})

export const deleteImageInputSchema = z.object({
  filename: filenameSchema,
})

// ============================================
// AI/SEO Schemas
// ============================================

export const optimizeInputSchema = z.object({
  slug: slugSchema,
  directory: directorySchema,
})

export const applyFixesInputSchema = z.object({
  content: postContentSchema,
  recommendations: z.array(z.string()).max(20, 'Too many recommendations'),
  frontmatter: z.record(z.string()),
})

export const updateWithFeedbackInputSchema = z.object({
  content: postContentSchema,
  feedback: z.string().min(5, 'Feedback is required').max(2000, 'Feedback too long'),
  frontmatter: z.record(z.string()).optional(),
})

export const generateSEOInputSchema = z.object({
  content: postContentSchema,
  existingTitle: z.string().optional(),
  existingKeyword: z.string().optional(),
})

export const researchInputSchema = z.object({
  topic: z.string().min(1).max(500, 'Topic too long'),
  targetAudience: z.string().max(500).optional(),
  competitors: z.array(z.string().max(200)).max(10).optional(),
})

export const writeInputSchema = z.object({
  topic: z.string().min(1).max(500),
  primaryKeyword: z.string().min(1).max(100),
  secondaryKeywords: z.array(z.string().max(100)).max(10).optional(),
  outline: z.array(z.string().max(500)).max(20).optional(),
  targetWordCount: z.number().min(100).max(50000).optional(),
  researchBrief: z.string().max(50000, 'Research brief too large').optional(),
})

export const analyzeInputSchema = z.object({
  slug: slugSchema,
  directory: directorySchema,
  competitors: z.array(z.string().max(200)).max(10).optional(),
})

export const rewriteInputSchema = z.object({
  slug: slugSchema,
  directory: directorySchema,
  targetKeyword: z.string().max(100).optional(),
  instructions: z.string().max(2000, 'Instructions too long').optional(),
})

export const applyValidationFixesInputSchema = z.object({
  content: postContentSchema,
  issues: z.array(z.object({
    type: z.enum(['brand_term', 'capitalization', 'style']),
    found: z.string(),
    expected: z.string(),
    count: z.number(),
    locations: z.array(z.string()),
  })).max(50),
})

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate input and return typed result or throw
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    throw new Error(`Validation failed: ${errors}`)
  }
  return result.data
}

/**
 * Create a validator function for server function input
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => validateInput(schema, data)
}
