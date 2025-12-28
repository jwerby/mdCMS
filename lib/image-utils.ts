/**
 * Client-side image conversion utilities
 * Converts various image formats to WebP in the browser
 * Supports HEIC (iPhone photos) with lazy-loaded decoder
 */

export interface ConversionResult {
  blob: Blob
  width: number
  height: number
}

export interface ConversionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const DEFAULT_OPTIONS: ConversionOptions = {
  maxWidth: 1200,
  quality: 0.8
}

/**
 * Check if file is HEIC format
 */
function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  )
}

/**
 * Convert HEIC to JPEG using lazy-loaded heic2any
 * Only loads the ~1MB library when actually needed
 */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')

  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9
  })

  // heic2any can return array or single blob
  return Array.isArray(result) ? result[0] : result
}

/**
 * Load image into canvas for processing
 */
async function loadImageToCanvas(
  file: File | Blob,
  options: ConversionOptions
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const img = new Image()
  const url = URL.createObjectURL(file)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })

  URL.revokeObjectURL(url)

  // Calculate dimensions respecting max size
  let { width, height } = img
  const maxWidth = options.maxWidth || DEFAULT_OPTIONS.maxWidth!
  const maxHeight = options.maxHeight || maxWidth * 2 // reasonable default

  if (width > maxWidth) {
    height = (height * maxWidth) / width
    width = maxWidth
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height
    height = maxHeight
  }

  // Round to integers
  width = Math.round(width)
  height = Math.round(height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, 0, 0, width, height)

  return { canvas, width, height }
}

/**
 * Convert canvas to WebP blob
 */
function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert to WebP'))
        }
      },
      'image/webp',
      quality
    )
  })
}

/**
 * Main conversion function
 * Converts any supported image format to WebP
 *
 * Supported formats:
 * - JPEG, PNG, WebP, GIF, BMP (native browser support)
 * - HEIC/HEIF (iPhone photos - lazy loads decoder)
 */
export async function convertToWebp(
  file: File,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  let processableFile: File | Blob = file

  // Handle HEIC files (iPhone photos)
  if (isHeicFile(file)) {
    processableFile = await convertHeicToJpeg(file)
  }

  // Load and resize in canvas
  const { canvas, width, height } = await loadImageToCanvas(processableFile, opts)

  // Convert to WebP
  const blob = await canvasToWebp(canvas, opts.quality!)

  return { blob, width, height }
}

/**
 * Get a clean filename for the converted image
 */
export function getWebpFilename(originalFilename: string): string {
  const nameWithoutExt = originalFilename.replace(/\.[^.]+$/, '')
  const safeName = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const timestamp = Date.now()
  return `${safeName}-${timestamp}.webp`
}

/**
 * Check browser support for WebP encoding
 */
export function supportsWebpEncoding(): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}
