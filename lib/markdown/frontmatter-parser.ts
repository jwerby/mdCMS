/**
 * Shared frontmatter parser for markdown files
 * Extracted for reuse and memoization
 */

// Simple LRU cache for parsed frontmatter
const parseCache = new Map<number, { frontmatter: Record<string, unknown>; body: string }>()
const MAX_CACHE_SIZE = 100

function hashContent(content: string): number {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash
}

function needsQuoting(value: string): boolean {
  return /[:\n"\[\],]/.test(value)
}

function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function unescapeValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function splitArrayItems(input: string): string[] {
  const items: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"' && input[i - 1] !== '\\') {
      inQuotes = !inQuotes
      current += ch
      continue
    }
    if (ch === ',' && !inQuotes) {
      items.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) items.push(current.trim())
  return items
}

/**
 * Parse YAML-like frontmatter from markdown content
 * Uses simple key:value parsing suitable for flat frontmatter
 *
 * @param content - Full markdown content with frontmatter
 * @returns Parsed frontmatter object and body content
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string
): { frontmatter: T; body: string } {
  // Check cache first
  const hash = hashContent(content)
  const cached = parseCache.get(hash)
  if (cached) {
    return cached as { frontmatter: T; body: string }
  }

  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    // No frontmatter found, try to extract title from first heading
    const lines = content.split('\n')
    const firstHeading = lines.find(l => l.startsWith('# '))
    const title = firstHeading ? firstHeading.replace(/^#\s+/, '') : 'Untitled'
    const result = {
      frontmatter: { title } as T,
      body: content
    }
    cacheResult(hash, result as { frontmatter: Record<string, unknown>; body: string })
    return result
  }

  const frontmatterStr = match[1] ?? ''
  const body = match[2] ?? ''
  const frontmatter: Record<string, unknown> = {}
  const lines = frontmatterStr.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    // Handle arrays: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      const rawItems = inner ? splitArrayItems(inner) : []
      frontmatter[key] = rawItems.map(item => {
        const trimmed = item.trim()
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          return unescapeValue(trimmed.slice(1, -1))
        }
        return trimmed
      })
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      frontmatter[key] = unescapeValue(value.slice(1, -1))
    }
    // Handle booleans
    else if (value === 'true') {
      frontmatter[key] = true
    }
    else if (value === 'false') {
      frontmatter[key] = false
    }
    // Handle numbers
    else if (/^-?\d+(\.\d+)?$/.test(value)) {
      frontmatter[key] = parseFloat(value)
    }
    // Default: string value
    else {
      frontmatter[key] = value
    }
  }

  const result = { frontmatter: frontmatter as T, body }
  cacheResult(hash, result as { frontmatter: Record<string, unknown>; body: string })
  return result
}

function cacheResult(hash: number, result: { frontmatter: Record<string, unknown>; body: string }) {
  // LRU eviction
  if (parseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = parseCache.keys().next().value
    if (firstKey !== undefined) {
      parseCache.delete(firstKey)
    }
  }
  parseCache.set(hash, result)
}

/**
 * Serialize frontmatter object back to YAML-like string
 */
export function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
  const lines: string[] = ['---']

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === '') continue

    if (Array.isArray(value)) {
      const rendered = value.map((item) => {
        const asString = String(item)
        return needsQuoting(asString) ? `"${escapeValue(asString)}"` : asString
      })
      lines.push(`${key}: [${rendered.join(', ')}]`)
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`)
    } else {
      const asString = String(value)
      const safe = needsQuoting(asString) ? `"${escapeValue(asString)}"` : asString
      lines.push(`${key}: ${safe}`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}

/**
 * Clear the frontmatter parse cache
 */
export function clearFrontmatterCache(): void {
  parseCache.clear()
}
