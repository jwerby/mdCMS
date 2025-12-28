/**
 * URL Sanitization for XSS Prevention
 *
 * Blocks dangerous URL schemes that can execute JavaScript or other code.
 * Only allows safe protocols and relative URLs.
 */

/**
 * Protocols that are allowed in URLs
 */
const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:',
])

/**
 * Dangerous URL patterns that can execute code
 */
const DANGEROUS_PATTERNS = [
  /^javascript:/i,
  /^vbscript:/i,
  /^data:(?!image\/)/i, // Allow data: only for images (data:image/*)
  /^file:/i,
]

/**
 * Pattern for data URIs that are allowed (only images)
 */
const ALLOWED_DATA_URI = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i

/**
 * Result of URL sanitization
 */
export interface SanitizeUrlResult {
  /** Whether the URL is safe */
  isSafe: boolean
  /** The sanitized URL (or '#' if blocked) */
  url: string
  /** Error message if the URL was blocked */
  error?: string
  /** The detected protocol */
  protocol?: string
}

/**
 * Sanitize a URL for safe use in href or src attributes
 *
 * Blocks:
 * - javascript: protocol (XSS)
 * - vbscript: protocol (legacy XSS)
 * - data: URLs (except for images)
 * - file: protocol
 *
 * Allows:
 * - http: and https: URLs
 * - mailto: and tel: links
 * - Relative URLs (starting with /, #, or alphanumeric)
 * - Anchor links (#section)
 * - data:image/* URLs (for inline images)
 *
 * @param url - The URL to sanitize
 * @returns SanitizeUrlResult with safety status and sanitized URL
 */
export function sanitizeUrl(url: string | undefined | null): SanitizeUrlResult {
  // Handle empty/null/undefined URLs
  if (!url || typeof url !== 'string') {
    return {
      isSafe: false,
      url: '#',
      error: 'Empty or invalid URL',
    }
  }

  // Trim whitespace and normalize
  const trimmed = url.trim()

  // Empty after trim
  if (!trimmed) {
    return {
      isSafe: false,
      url: '#',
      error: 'Empty URL after trimming',
    }
  }

  // Decode any URL encoding to catch obfuscation attempts
  let decoded: string
  try {
    // Multiple decode passes to catch nested encoding
    decoded = trimmed
    let prev = ''
    let iterations = 0
    while (decoded !== prev && iterations < 5) {
      prev = decoded
      decoded = decodeURIComponent(decoded)
      iterations++
    }
  } catch {
    // If decoding fails, use original (might have invalid encoding)
    decoded = trimmed
  }

  // Remove null bytes and control characters
  decoded = decoded.replace(/[\x00-\x1f]/g, '')

  // Check for dangerous patterns (case-insensitive)
  const lowerDecoded = decoded.toLowerCase().replace(/\s/g, '')

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(lowerDecoded)) {
      // Special case: allow data:image/* URLs
      if (lowerDecoded.startsWith('data:image/')) {
        if (ALLOWED_DATA_URI.test(decoded)) {
          return {
            isSafe: true,
            url: decoded,
            protocol: 'data:',
          }
        }
        return {
          isSafe: false,
          url: '#',
          error: 'Only base64-encoded images are allowed in data URIs',
        }
      }

      return {
        isSafe: false,
        url: '#',
        error: `Blocked dangerous URL pattern: ${pattern.source}`,
      }
    }
  }

  // Try to parse as a URL to check protocol
  try {
    // Check if it's a relative URL (starts with /, #, ?, or alphanumeric)
    if (/^[/#?]/.test(decoded) || /^[a-z0-9][\w.-]*(?:[/?#]|$)/i.test(decoded)) {
      // Relative URLs are allowed
      return {
        isSafe: true,
        url: decoded,
        protocol: 'relative',
      }
    }

    // Check for protocol-relative URLs (//example.com)
    if (decoded.startsWith('//')) {
      return {
        isSafe: true,
        url: decoded,
        protocol: 'https:', // Assume https for protocol-relative
      }
    }

    // Parse the URL
    const parsed = new URL(decoded, 'https://example.com')

    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return {
        isSafe: true,
        url: decoded,
        protocol: parsed.protocol,
      }
    }

    return {
      isSafe: false,
      url: '#',
      error: `Blocked protocol: ${parsed.protocol}`,
      protocol: parsed.protocol,
    }
  } catch {
    // If URL parsing fails, check if it looks like a relative URL
    if (/^[\w./-]+$/.test(decoded)) {
      return {
        isSafe: true,
        url: decoded,
        protocol: 'relative',
      }
    }

    return {
      isSafe: false,
      url: '#',
      error: 'Invalid URL format',
    }
  }
}

/**
 * Get a safe URL for use in href or src attributes
 * Returns the URL if safe, or '#' if blocked
 *
 * @param url - The URL to sanitize
 * @returns Safe URL string
 */
export function getSafeUrl(url: string | undefined | null): string {
  return sanitizeUrl(url).url
}

/**
 * Check if a URL is safe without returning the sanitized version
 *
 * @param url - The URL to check
 * @returns true if the URL is safe
 */
export function isUrlSafe(url: string | undefined | null): boolean {
  return sanitizeUrl(url).isSafe
}

/**
 * Sanitize a URL specifically for image src attributes
 * Allows http(s), relative URLs, and data:image/* URIs
 *
 * @param src - The image source URL
 * @returns Safe URL string
 */
export function getSafeImageSrc(src: string | undefined | null): string {
  const result = sanitizeUrl(src)
  return result.url
}

/**
 * Log a blocked URL attempt for security monitoring
 * This should be called when a URL is blocked for tracking purposes
 */
export function logBlockedUrl(url: string, context: string): void {
  const result = sanitizeUrl(url)
  if (!result.isSafe) {
    // Use the security logging we already have
    console.warn('[SECURITY] Blocked URL:', {
      url: url.slice(0, 100), // Truncate for logging
      context,
      error: result.error,
      timestamp: new Date().toISOString(),
    })
  }
}
