/**
 * Auto-save utility for localStorage draft recovery
 * Saves content periodically and provides recovery when server content differs
 */

export interface AutosaveData {
  content: string
  frontmatter?: Record<string, unknown>
  savedAt: number
  slug: string
  type: 'post' | 'page'
}

const AUTOSAVE_KEY_PREFIX = 'mdcms_autosave_'
const AUTOSAVE_INTERVAL = 30000 // 30 seconds

/**
 * Generate a storage key for a specific document
 */
function getStorageKey(type: 'post' | 'page', slug: string): string {
  return `${AUTOSAVE_KEY_PREFIX}${type}_${slug}`
}

/**
 * Save content to localStorage
 */
export function saveToLocalStorage(
  type: 'post' | 'page',
  slug: string,
  content: string,
  frontmatter?: Record<string, unknown>
): void {
  try {
    const data: AutosaveData = {
      content,
      frontmatter,
      savedAt: Date.now(),
      slug,
      type
    }
    localStorage.setItem(getStorageKey(type, slug), JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to save to localStorage:', error)
  }
}

/**
 * Load content from localStorage
 */
export function loadFromLocalStorage(
  type: 'post' | 'page',
  slug: string
): AutosaveData | null {
  try {
    const stored = localStorage.getItem(getStorageKey(type, slug))
    if (!stored) return null

    const data = JSON.parse(stored) as AutosaveData

    // Check if data is older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    if (data.savedAt < sevenDaysAgo) {
      clearLocalStorage(type, slug)
      return null
    }

    return data
  } catch (error) {
    console.warn('Failed to load from localStorage:', error)
    return null
  }
}

/**
 * Clear saved content from localStorage
 */
export function clearLocalStorage(type: 'post' | 'page', slug: string): void {
  try {
    localStorage.removeItem(getStorageKey(type, slug))
  } catch (error) {
    console.warn('Failed to clear localStorage:', error)
  }
}

/**
 * Check if localStorage has a draft that differs from server content
 */
export function hasUnsavedChanges(
  type: 'post' | 'page',
  slug: string,
  serverContent: string
): boolean {
  const saved = loadFromLocalStorage(type, slug)
  if (!saved) return false

  // Normalize content for comparison (trim whitespace)
  const normalizedSaved = saved.content.trim()
  const normalizedServer = serverContent.trim()

  return normalizedSaved !== normalizedServer
}

/**
 * Format time ago string
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  return `${Math.floor(seconds / 86400)} days ago`
}

/**
 * Hook-style autosave manager
 */
export class AutosaveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private type: 'post' | 'page'
  private slug: string
  private onSave?: () => void

  constructor(type: 'post' | 'page', slug: string, onSave?: () => void) {
    this.type = type
    this.slug = slug
    this.onSave = onSave
  }

  /**
   * Start periodic autosave
   */
  start(getContent: () => { content: string; frontmatter?: Record<string, unknown> }): void {
    this.stop() // Clear any existing interval

    this.intervalId = setInterval(() => {
      const { content, frontmatter } = getContent()
      saveToLocalStorage(this.type, this.slug, content, frontmatter)
      this.onSave?.()
    }, AUTOSAVE_INTERVAL)
  }

  /**
   * Stop periodic autosave
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Manual save (e.g., on blur or before navigation)
   */
  save(content: string, frontmatter?: Record<string, unknown>): void {
    saveToLocalStorage(this.type, this.slug, content, frontmatter)
    this.onSave?.()
  }

  /**
   * Load any saved draft
   */
  load(): AutosaveData | null {
    return loadFromLocalStorage(this.type, this.slug)
  }

  /**
   * Clear saved draft
   */
  clear(): void {
    clearLocalStorage(this.type, this.slug)
  }

  /**
   * Check if there's a recoverable draft
   */
  hasRecovery(serverContent: string): boolean {
    return hasUnsavedChanges(this.type, this.slug, serverContent)
  }
}

/**
 * Get all autosaved drafts (for showing in a recovery list)
 */
export function getAllAutosaves(): AutosaveData[] {
  const drafts: AutosaveData[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(AUTOSAVE_KEY_PREFIX)) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            drafts.push(JSON.parse(data) as AutosaveData)
          } catch {
            // Skip invalid entries
          }
        }
      }
    }
  } catch {
    // localStorage not available
  }

  return drafts.sort((a, b) => b.savedAt - a.savedAt)
}
