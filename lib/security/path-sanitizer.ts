import path from 'path'
import { auditLog } from './audit-log'

/**
 * Security utility to prevent path traversal attacks
 * Sanitizes user-provided paths/slugs to prevent directory traversal
 */

// Characters allowed in slugs/filenames
const SAFE_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = [
  /\.\./,           // Parent directory traversal
  /\/\//,           // Double slashes
  /\\/,             // Backslashes
  /\x00/,           // Null bytes
  /%2e/i,           // URL encoded dots
  /%2f/i,           // URL encoded slashes
  /%5c/i,           // URL encoded backslashes
  /%00/,            // URL encoded null
]

export interface SanitizeResult {
  isValid: boolean
  sanitized: string
  error?: string
}

/**
 * Sanitize a slug to prevent path traversal
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function sanitizeSlug(slug: string): SanitizeResult {
  if (!slug || typeof slug !== 'string') {
    return { isValid: false, sanitized: '', error: 'Slug is required' }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(slug)) {
      logSecurityEvent('path_traversal_attempt', { slug, pattern: pattern.toString() })
      return { isValid: false, sanitized: '', error: 'Invalid characters in slug' }
    }
  }

  // Remove any path components
  const basename = path.basename(slug)

  // Strip file extension if present
  const withoutExt = basename.replace(/\.[^.]+$/, '')

  // Check against safe pattern
  if (!SAFE_SLUG_PATTERN.test(withoutExt)) {
    return { isValid: false, sanitized: '', error: 'Slug contains invalid characters' }
  }

  return { isValid: true, sanitized: withoutExt }
}

/**
 * Sanitize a filename (allows dots for extensions)
 */
export function sanitizeFilename(filename: string): SanitizeResult {
  if (!filename || typeof filename !== 'string') {
    return { isValid: false, sanitized: '', error: 'Filename is required' }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filename)) {
      logSecurityEvent('path_traversal_attempt', { filename, pattern: pattern.toString() })
      return { isValid: false, sanitized: '', error: 'Invalid characters in filename' }
    }
  }

  // Get just the basename
  const basename = path.basename(filename)

  // Allow alphanumeric, hyphens, underscores, and single dots
  const safeFilename = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

  if (!safeFilename.test(basename)) {
    return { isValid: false, sanitized: '', error: 'Filename contains invalid characters' }
  }

  // Prevent hidden files
  if (basename.startsWith('.')) {
    return { isValid: false, sanitized: '', error: 'Hidden files not allowed' }
  }

  return { isValid: true, sanitized: basename }
}

/**
 * Verify that a resolved path is within the allowed base directory
 * Prevents escaping the content directory via symlinks or traversal
 */
export function isPathWithinBase(filePath: string, baseDir: string): boolean {
  const resolvedPath = path.resolve(filePath)
  const resolvedBase = path.resolve(baseDir)

  // Ensure the resolved path starts with the base directory
  const isWithin = resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase

  if (!isWithin) {
    logSecurityEvent('path_escape_attempt', { filePath, baseDir, resolvedPath })
  }

  return isWithin
}

/**
 * Build a safe file path within a base directory
 * Returns null if the path would escape the base
 */
export function buildSafePath(baseDir: string, ...segments: string[]): string | null {
  // Sanitize each segment
  for (const segment of segments) {
    const result = sanitizeSlug(segment.replace(/\.md$/, ''))
    if (!result.isValid) {
      return null
    }
  }

  // Build the path
  const targetPath = path.join(baseDir, ...segments)

  // Verify containment
  if (!isPathWithinBase(targetPath, baseDir)) {
    return null
  }

  return targetPath
}

// Security event logging
interface SecurityEvent {
  timestamp: string
  type: string
  details: Record<string, unknown>
}

const securityLog: SecurityEvent[] = []

/**
 * Log a security event for audit purposes
 */
export function logSecurityEvent(type: string, details: Record<string, unknown>): void {
  const event: SecurityEvent = {
    timestamp: new Date().toISOString(),
    type,
    details
  }

  securityLog.push(event)

  // Keep only last 1000 events in memory
  if (securityLog.length > 1000) {
    securityLog.shift()
  }

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[SECURITY] ${type}:`, details)
  }

  // Also log to persistent audit log
  const eventTypeMap: Record<string, 'security_path_traversal' | 'security_invalid_input' | 'security_xss_blocked'> = {
    path_traversal_attempt: 'security_path_traversal',
    path_escape_attempt: 'security_path_traversal',
    invalid_slug: 'security_invalid_input',
    invalid_filename: 'security_invalid_input',
    xss_blocked: 'security_xss_blocked',
  }

  const auditEventType = eventTypeMap[type] || 'security_invalid_input'
  auditLog(auditEventType, {
    resource: details.slug as string || details.filename as string || details.filePath as string,
    details,
    success: false,
  })
}

/**
 * Get recent security events (for admin dashboard)
 */
export function getSecurityEvents(limit = 100): SecurityEvent[] {
  return securityLog.slice(-limit)
}
