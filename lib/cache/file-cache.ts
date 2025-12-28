/**
 * In-Memory File Cache with TTL Expiration
 *
 * Provides caching for file system operations to reduce I/O overhead.
 * Supports automatic TTL expiration and write-through invalidation.
 */

/**
 * Cache entry with value and expiration
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
  hash?: string
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttl: number
  /** Maximum number of entries (LRU eviction when exceeded) */
  maxEntries?: number
  /** Optional name for debugging */
  name?: string
}

/**
 * Default cache configurations for different use cases
 */
export const CACHE_CONFIGS = {
  /** Posts list - short TTL since users may edit frequently */
  posts: {
    ttl: 30 * 1000, // 30 seconds
    maxEntries: 50,
    name: 'posts',
  },
  /** Pages - moderate TTL */
  pages: {
    ttl: 60 * 1000, // 1 minute
    maxEntries: 100,
    name: 'pages',
  },
  /** AI context files - longer TTL since they rarely change */
  aiContext: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxEntries: 20,
    name: 'aiContext',
  },
  /** File content - moderate TTL */
  fileContent: {
    ttl: 60 * 1000, // 1 minute
    maxEntries: 200,
    name: 'fileContent',
  },
} as const

/**
 * Generic in-memory cache with TTL support
 */
export class FileCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = []
  private config: Required<CacheConfig>

  constructor(config: CacheConfig) {
    this.config = {
      ttl: config.ttl,
      maxEntries: config.maxEntries ?? 1000,
      name: config.name ?? 'default',
    }
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return undefined
    }

    // Update access order for LRU
    this.updateAccessOrder(key)

    return entry.value
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, hash?: string): void {
    // Enforce max entries with LRU eviction
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.config.ttl,
      hash,
    })

    this.updateAccessOrder(key)
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key)
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    return existed
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number
    maxEntries: number
    name: string
    ttl: number
  } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      name: this.config.name,
      ttl: this.config.ttl,
    }
  }

  /**
   * Cleanup expired entries (call periodically)
   */
  cleanup(): number {
    let count = 0
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  private updateAccessOrder(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    this.accessOrder.push(key)
  }

  private evictLRU(): void {
    const lruKey = this.accessOrder.shift()
    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }
}

// Global cache instances for different data types
const caches = new Map<string, FileCache<unknown>>()

/**
 * Get or create a cache instance
 */
export function getCache<T>(name: string, config?: CacheConfig): FileCache<T> {
  if (!caches.has(name)) {
    const cacheConfig = config ?? CACHE_CONFIGS[name as keyof typeof CACHE_CONFIGS] ?? {
      ttl: 60 * 1000,
      name,
    }
    caches.set(name, new FileCache(cacheConfig))
  }
  return caches.get(name) as FileCache<T>
}

/**
 * Posts cache instance
 */
export const postsCache = new FileCache<unknown>(CACHE_CONFIGS.posts)

/**
 * Pages cache instance
 */
export const pagesCache = new FileCache<unknown>(CACHE_CONFIGS.pages)

/**
 * AI context cache instance
 */
export const aiContextCache = new FileCache<string>(CACHE_CONFIGS.aiContext)

/**
 * General file content cache
 */
export const fileContentCache = new FileCache<string>(CACHE_CONFIGS.fileContent)

/**
 * Invalidate all related caches when content changes
 */
export function invalidateContentCache(type: 'post' | 'page', slug?: string): void {
  if (type === 'post') {
    if (slug) {
      postsCache.invalidatePattern(new RegExp(`.*${slug}.*`))
    } else {
      postsCache.clear()
    }
  } else if (type === 'page') {
    if (slug) {
      pagesCache.invalidatePattern(new RegExp(`.*${slug}.*`))
    } else {
      pagesCache.clear()
    }
  }
}

/**
 * Get all cache stats
 */
export function getAllCacheStats(): Record<string, ReturnType<FileCache<unknown>['getStats']>> {
  return {
    posts: postsCache.getStats(),
    pages: pagesCache.getStats(),
    aiContext: aiContextCache.getStats(),
    fileContent: fileContentCache.getStats(),
  }
}

/**
 * Cleanup all caches (call periodically)
 */
export function cleanupAllCaches(): Record<string, number> {
  return {
    posts: postsCache.cleanup(),
    pages: pagesCache.cleanup(),
    aiContext: aiContextCache.cleanup(),
    fileContent: fileContentCache.cleanup(),
  }
}

// Periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupAllCaches()
  }, 5 * 60 * 1000)
}

/**
 * Helper to create a cached version of an async function
 */
export function withCache<T>(
  cache: FileCache<T>,
  keyFn: (...args: unknown[]) => string,
  fn: (...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    const key = keyFn(...args)
    const cached = cache.get(key)

    if (cached !== undefined) {
      return cached
    }

    const result = await fn(...args)
    cache.set(key, result)
    return result
  }
}
