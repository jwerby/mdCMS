import { createServerFn } from '@tanstack/react-start'
import fs from 'fs'
import path from 'path'
import { sanitizeFilename, isPathWithinBase, logSecurityEvent } from '../../lib/security/path-sanitizer'
import { deleteImageInputSchema, validateInput } from '../../lib/validation/schemas'
import { z } from 'zod'

const IMAGES_DIR = path.join(process.cwd(), 'content', 'images')

// Maximum image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export interface UploadedImage {
  filename: string
  url: string
  size: number
  markdown?: string
}

// Ensure images directory exists
function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
  }
}

// Get all images
export const getImages = createServerFn({ method: 'GET' }).handler(async () => {
  ensureImagesDir()

  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => /\.(webp|jpg|jpeg|png|gif)$/i.test(f))
    .map(filename => ({
      filename,
      url: `/content/images/${filename}`,
      size: fs.statSync(path.join(IMAGES_DIR, filename)).size
    }))

  return files
})

// Image upload schema
const uploadImageInputSchema = z.object({
  filename: z.string().min(1).max(255),
  buffer: z.array(z.number()).max(MAX_IMAGE_SIZE),
  alreadyConverted: z.boolean().optional()
})

// Upload image (already converted to WebP on client)
export const uploadImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(uploadImageInputSchema, data))
  .handler(async ({ data }) => {
    ensureImagesDir()

    // Sanitize the filename
    const sanitized = sanitizeFilename(data.filename)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_filename', { filename: data.filename, error: sanitized.error })
      throw new Error('Invalid filename')
    }

    const filename = sanitized.sanitized
    const outputPath = path.join(IMAGES_DIR, filename)

    // Verify path is within images directory
    if (!isPathWithinBase(outputPath, IMAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { outputPath })
      throw new Error('Invalid file path')
    }

    // Check file size
    if (data.buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`)
    }

    // Convert array back to buffer and save
    const buffer = Buffer.from(data.buffer)
    fs.writeFileSync(outputPath, buffer)

    const stats = fs.statSync(outputPath)
    const originalName = filename.replace(/-\d+\.webp$/, '')

    return {
      success: true,
      filename,
      url: `/content/images/${filename}`,
      size: stats.size,
      markdown: `![${originalName}](/content/images/${filename})`
    }
  })

// Delete image
export const deleteImage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(deleteImageInputSchema, data))
  .handler(async ({ data }) => {
    // Sanitize the filename
    const sanitized = sanitizeFilename(data.filename)
    if (!sanitized.isValid) {
      logSecurityEvent('invalid_filename', { filename: data.filename, error: sanitized.error })
      throw new Error('Invalid filename')
    }

    const filePath = path.join(IMAGES_DIR, sanitized.sanitized)

    // Verify path is within images directory
    if (!isPathWithinBase(filePath, IMAGES_DIR)) {
      logSecurityEvent('path_escape_attempt', { filePath })
      throw new Error('Invalid file path')
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Image not found')
    }

    fs.unlinkSync(filePath)
    return { success: true, filename: sanitized.sanitized }
  })
