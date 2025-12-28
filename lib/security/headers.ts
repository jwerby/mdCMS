/**
 * Security headers middleware for TanStack Start
 * Adds essential security headers to all responses
 */

import type { HTTPEvent } from 'vinxi/http'
import { setResponseHeader } from 'vinxi/http'

/**
 * Security header configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy directive */
  contentSecurityPolicy?: string
  /** X-Frame-Options value */
  frameOptions?: 'DENY' | 'SAMEORIGIN'
  /** Enable X-Content-Type-Options: nosniff */
  noSniff?: boolean
  /** Enable X-XSS-Protection */
  xssProtection?: boolean
  /** Referrer-Policy value */
  referrerPolicy?: string
  /** Strict-Transport-Security value */
  hsts?: string
  /** Permissions-Policy directive */
  permissionsPolicy?: string
}

/**
 * Default security headers configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React/Vite
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.anthropic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  frameOptions: 'DENY',
  noSniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  hsts: 'max-age=31536000; includeSubDomains',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
}

/**
 * Apply security headers to a Vinxi HTTP event
 */
export function applySecurityHeaders(
  event: HTTPEvent,
  config: SecurityHeadersConfig = DEFAULT_SECURITY_CONFIG
): void {
  // Content-Security-Policy
  if (config.contentSecurityPolicy) {
    setResponseHeader(event, 'Content-Security-Policy', config.contentSecurityPolicy)
  }

  // X-Frame-Options - prevents clickjacking
  if (config.frameOptions) {
    setResponseHeader(event, 'X-Frame-Options', config.frameOptions)
  }

  // X-Content-Type-Options - prevents MIME sniffing
  if (config.noSniff) {
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  }

  // X-XSS-Protection - legacy but still useful for older browsers
  if (config.xssProtection) {
    setResponseHeader(event, 'X-XSS-Protection', '1; mode=block')
  }

  // Referrer-Policy - controls referrer information
  if (config.referrerPolicy) {
    setResponseHeader(event, 'Referrer-Policy', config.referrerPolicy)
  }

  // Strict-Transport-Security (HSTS) - enforces HTTPS
  if (config.hsts) {
    setResponseHeader(event, 'Strict-Transport-Security', config.hsts)
  }

  // Permissions-Policy - restricts browser features
  if (config.permissionsPolicy) {
    setResponseHeader(event, 'Permissions-Policy', config.permissionsPolicy)
  }
}

/**
 * Create a security headers middleware handler wrapper
 * Wraps an existing handler and applies security headers
 */
export function withSecurityHeaders<T extends (...args: unknown[]) => unknown>(
  handler: T,
  config?: SecurityHeadersConfig
): T {
  return (async (...args: Parameters<T>) => {
    // The first argument in TanStack Start handlers is typically the context
    // which may contain the event
    const ctx = args[0] as { event?: HTTPEvent } | undefined
    if (ctx?.event) {
      applySecurityHeaders(ctx.event, config)
    }
    return handler(...args)
  }) as T
}

/**
 * Get security headers as a plain object (for testing or other use cases)
 */
export function getSecurityHeadersObject(
  config: SecurityHeadersConfig = DEFAULT_SECURITY_CONFIG
): Record<string, string> {
  const headers: Record<string, string> = {}

  if (config.contentSecurityPolicy) {
    headers['Content-Security-Policy'] = config.contentSecurityPolicy
  }
  if (config.frameOptions) {
    headers['X-Frame-Options'] = config.frameOptions
  }
  if (config.noSniff) {
    headers['X-Content-Type-Options'] = 'nosniff'
  }
  if (config.xssProtection) {
    headers['X-XSS-Protection'] = '1; mode=block'
  }
  if (config.referrerPolicy) {
    headers['Referrer-Policy'] = config.referrerPolicy
  }
  if (config.hsts) {
    headers['Strict-Transport-Security'] = config.hsts
  }
  if (config.permissionsPolicy) {
    headers['Permissions-Policy'] = config.permissionsPolicy
  }

  return headers
}
