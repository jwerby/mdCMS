/**
 * Shared inline markdown parser for MarkdownRenderer components
 * Extracted for memoization and code reuse
 */

import React from 'react'
import { getSafeUrl } from '../security/url-sanitizer'

/**
 * Parse inline markdown elements (code, links, bold, italic)
 * Memoization-friendly: pure function with no side effects
 */
export function parseInlineText(
  input: string,
  key: number = 0,
  classNames?: {
    code?: string
    link?: string
    bold?: string
    italic?: string
  }
): React.ReactNode[] {
  const classes = {
    code: classNames?.code ?? 'bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-xs font-bold',
    link: classNames?.link ?? 'text-indigo-600 hover:text-indigo-800 underline underline-offset-4 decoration-indigo-300 hover:decoration-indigo-500 transition-colors',
    bold: classNames?.bold ?? 'font-bold text-slate-900',
    italic: classNames?.italic ?? 'italic',
  }

  const result: React.ReactNode[] = []
  let remaining = input
  let idx = 0

  while (remaining.length > 0) {
    // Code
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      result.push(
        React.createElement('code', {
          key: `${key}-c-${idx}`,
          className: classes.code,
        }, codeMatch[1])
      )
      remaining = remaining.slice(codeMatch[0].length)
      idx++
      continue
    }

    // Links - support optional title: [text](url "title")
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/)
    if (linkMatch) {
      const safeHref = getSafeUrl(linkMatch[2])
      result.push(
        React.createElement('a', {
          key: `${key}-a-${idx}`,
          href: safeHref,
          title: linkMatch[3] || undefined,
          className: classes.link,
        }, linkMatch[1])
      )
      remaining = remaining.slice(linkMatch[0].length)
      idx++
      continue
    }

    // Strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      const innerContent = parseInlineText(strikeMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('del', {
          key: `${key}-del-${idx}`,
          className: 'line-through text-slate-400',
        }, ...innerContent)
      )
      remaining = remaining.slice(strikeMatch[0].length)
      idx++
      continue
    }

    // Highlight ==text==
    const highlightMatch = remaining.match(/^==(.+?)==/)
    if (highlightMatch) {
      const innerContent = parseInlineText(highlightMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('mark', {
          key: `${key}-mark-${idx}`,
          className: 'bg-yellow-200 px-1 rounded',
        }, ...innerContent)
      )
      remaining = remaining.slice(highlightMatch[0].length)
      idx++
      continue
    }

    // Bold with asterisks **text**
    const boldAsteriskMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldAsteriskMatch) {
      const innerContent = parseInlineText(boldAsteriskMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('strong', {
          key: `${key}-b-${idx}`,
          className: classes.bold,
        }, ...innerContent)
      )
      remaining = remaining.slice(boldAsteriskMatch[0].length)
      idx++
      continue
    }

    // Bold with underscores __text__
    const boldUnderscoreMatch = remaining.match(/^__(.+?)__/)
    if (boldUnderscoreMatch) {
      const innerContent = parseInlineText(boldUnderscoreMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('strong', {
          key: `${key}-bu-${idx}`,
          className: classes.bold,
        }, ...innerContent)
      )
      remaining = remaining.slice(boldUnderscoreMatch[0].length)
      idx++
      continue
    }

    // Italic with asterisks *text*
    const italicAsteriskMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicAsteriskMatch) {
      const innerContent = parseInlineText(italicAsteriskMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('em', {
          key: `${key}-i-${idx}`,
          className: classes.italic,
        }, ...innerContent)
      )
      remaining = remaining.slice(italicAsteriskMatch[0].length)
      idx++
      continue
    }

    // Italic with underscores _text_
    const italicUnderscoreMatch = remaining.match(/^_([^_]+)_/)
    if (italicUnderscoreMatch) {
      const innerContent = parseInlineText(italicUnderscoreMatch[1], key * 1000 + idx, classNames)
      result.push(
        React.createElement('em', {
          key: `${key}-iu-${idx}`,
          className: classes.italic,
        }, ...innerContent)
      )
      remaining = remaining.slice(italicUnderscoreMatch[0].length)
      idx++
      continue
    }

    // Regular text - consume until next special character
    const nextSpecial = remaining.search(/[`\[\*_~=]/)
    if (nextSpecial === -1) {
      result.push(remaining)
      break
    } else if (nextSpecial === 0) {
      result.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      result.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
    idx++
  }

  return result
}

/**
 * Simple content hash for memoization dependency
 * Uses a fast, non-cryptographic hash suitable for change detection
 */
export function contentHash(content: string): number {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash
}

/**
 * Create a memoized parseInline function with specific class names
 */
export function createInlineParser(classNames?: Parameters<typeof parseInlineText>[2]) {
  return (text: string, key: number = 0): React.ReactNode[] => {
    return parseInlineText(text, key, classNames)
  }
}
