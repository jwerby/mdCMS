/**
 * Content statistics utilities
 */

export interface ContentStats {
  wordCount: number
  characterCount: number
  readingTime: number // in minutes
}

/**
 * Calculate content statistics from markdown text
 * @param content - Markdown content (without frontmatter)
 */
export function calculateStats(content: string): ContentStats {
  // Remove markdown formatting for accurate word count
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Convert links to text
    .replace(/#+\s/g, '') // Remove heading markers
    .replace(/[*_~]+/g, '') // Remove emphasis markers
    .replace(/>\s/g, '') // Remove blockquote markers
    .replace(/-\s|\*\s|\d+\.\s/g, '') // Remove list markers
    .replace(/---/g, '') // Remove horizontal rules
    .trim()

  // Count words (split on whitespace, filter empty)
  const words = plainText.split(/\s+/).filter(word => word.length > 0)
  const wordCount = words.length

  // Character count (including spaces)
  const characterCount = content.length

  // Reading time: average 200 words per minute
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  return {
    wordCount,
    characterCount,
    readingTime
  }
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
  if (minutes === 1) return '1 min read'
  return `${minutes} min read`
}

/**
 * Format word count for display
 */
export function formatWordCount(count: number): string {
  if (count === 1) return '1 word'
  return `${count.toLocaleString()} words`
}
