/**
 * Rate limiting for AI endpoints using TanStack Pacer
 * Protects against API abuse and excessive AI token consumption
 */

import { RateLimiter } from '@tanstack/pacer'
import { logSecurityEvent } from './path-sanitizer'
import { auditLog } from './audit-log'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number
  /** Time window in milliseconds */
  window: number
  /** Identifier for this limiter (for logging) */
  name: string
}

/**
 * Default configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  /** AI content generation - expensive, limit strictly */
  ai_generation: {
    limit: 10,
    window: 60 * 1000, // 10 requests per minute
    name: 'ai_generation'
  },
  /** AI analysis - moderate cost */
  ai_analysis: {
    limit: 20,
    window: 60 * 1000, // 20 requests per minute
    name: 'ai_analysis'
  },
  /** SEO optimization - moderate cost */
  ai_seo: {
    limit: 15,
    window: 60 * 1000, // 15 requests per minute
    name: 'ai_seo'
  },
  /** General API - higher limit */
  general: {
    limit: 100,
    window: 60 * 1000, // 100 requests per minute
    name: 'general'
  }
} as const

/**
 * IP-based rate limiter store
 * Maps IP addresses to their rate limiter instances
 */
const ipLimiters = new Map<string, Map<string, RateLimiter<[], void>>>()

/**
 * Clean up old limiters periodically (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupOldLimiters() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now

  // Remove limiters that haven't been used in the last 10 minutes
  const staleThreshold = 10 * 60 * 1000

  for (const [ip, limitersMap] of ipLimiters.entries()) {
    for (const [name, limiter] of limitersMap.entries()) {
      const state = limiter.store.state
      // If the limiter hasn't had activity, remove it
      if (state.executionCount === 0) {
        limitersMap.delete(name)
      }
    }
    if (limitersMap.size === 0) {
      ipLimiters.delete(ip)
    }
  }
}

/**
 * Get or create a rate limiter for an IP address and endpoint type
 */
function getOrCreateLimiter(
  ip: string,
  config: RateLimitConfig
): RateLimiter<[], void> {
  cleanupOldLimiters()

  if (!ipLimiters.has(ip)) {
    ipLimiters.set(ip, new Map())
  }

  const ipMap = ipLimiters.get(ip)!

  if (!ipMap.has(config.name)) {
    const limiter = new RateLimiter<[], void>(
      () => {
        // No-op function - we just use the limiter for counting
      },
      {
        limit: config.limit,
        window: config.window,
        onReject: () => {
          logSecurityEvent('rate_limit_exceeded', {
            ip,
            endpoint: config.name,
            limit: config.limit,
            window: config.window
          })
          // Also log to persistent audit log
          auditLog('auth_rate_limited', {
            ipAddress: ip,
            resource: config.name,
            details: { limit: config.limit, window: config.window },
            success: false,
          })
        }
      }
    )
    ipMap.set(config.name, limiter)
  }

  return ipMap.get(config.name)!
}

/**
 * Check if a request should be rate limited
 * Returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(ip: string, config: RateLimitConfig): boolean {
  const limiter = getOrCreateLimiter(ip, config)
  return limiter.maybeExecute()
}

/**
 * Get remaining requests in the current window
 */
export function getRemainingRequests(ip: string, config: RateLimitConfig): number {
  const limiter = getOrCreateLimiter(ip, config)
  return limiter.getRemainingInWindow()
}

/**
 * Get milliseconds until the rate limit window resets
 */
export function getMsUntilReset(ip: string, config: RateLimitConfig): number {
  const limiter = getOrCreateLimiter(ip, config)
  return limiter.getMsUntilNextWindow()
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends Error {
  public readonly retryAfterMs: number
  public readonly remaining: number

  constructor(retryAfterMs: number, remaining: number) {
    super(`Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
    this.remaining = remaining
  }
}

/**
 * Wrapper to apply rate limiting to a server function handler
 * Throws RateLimitError if limit exceeded
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: RateLimitConfig,
  getIp: () => string = () => 'default'
): T {
  return (async (...args: Parameters<T>) => {
    const ip = getIp()

    if (!checkRateLimit(ip, config)) {
      const retryAfterMs = getMsUntilReset(ip, config)
      const remaining = getRemainingRequests(ip, config)
      throw new RateLimitError(retryAfterMs, remaining)
    }

    return fn(...args)
  }) as T
}

/**
 * Create a rate-limited version of a function using TanStack Pacer
 * For use in server functions where we need to track per-IP limits
 */
export function createRateLimitedHandler<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>,
  config: RateLimitConfig,
  getIp: (input: TInput) => string
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const ip = getIp(input)

    if (!checkRateLimit(ip, config)) {
      const retryAfterMs = getMsUntilReset(ip, config)
      throw new RateLimitError(retryAfterMs, 0)
    }

    return handler(input)
  }
}

/**
 * Get current rate limit stats (for admin/debugging)
 */
export function getRateLimitStats(): {
  totalIps: number
  limiters: { ip: string; name: string; remaining: number }[]
} {
  const limiters: { ip: string; name: string; remaining: number }[] = []

  for (const [ip, limitersMap] of ipLimiters.entries()) {
    for (const [name, limiter] of limitersMap.entries()) {
      limiters.push({
        ip,
        name,
        remaining: limiter.getRemainingInWindow()
      })
    }
  }

  return {
    totalIps: ipLimiters.size,
    limiters
  }
}
