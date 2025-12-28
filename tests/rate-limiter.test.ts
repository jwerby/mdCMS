import { describe, it, expect, vi } from 'vitest'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '../lib/security/rate-limiter'

describe('rate limiter', () => {
  it('does not throw when checking limit', () => {
    expect(() => checkRateLimit('127.0.0.1', RATE_LIMIT_CONFIGS.ai_seo)).not.toThrow()
  })

  it('returns a boolean result', () => {
    const result = checkRateLimit('127.0.0.1', RATE_LIMIT_CONFIGS.ai_seo)
    expect(typeof result).toBe('boolean')
  })

  it('runs cleanup without store API errors', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now + 6 * 60 * 1000)
    expect(() => checkRateLimit('127.0.0.1', RATE_LIMIT_CONFIGS.ai_seo)).not.toThrow()
    vi.useRealTimers()
  })
})
