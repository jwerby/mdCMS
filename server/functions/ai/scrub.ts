import { createServerFn } from '@tanstack/react-start'
import fs from 'fs'
import path from 'path'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface ScrubInput {
  slug: string
  directory: 'published' | 'drafts'
}

export interface ScrubResult {
  success: boolean
  changes: number
  details: string[]
}

/**
 * Remove AI watermarks and telltale signs from content
 */
export const runScrub = createServerFn({ method: 'POST' })
  .inputValidator((data: ScrubInput) => data)
  .handler(async ({ data }) => {
    // Find the file
    const dir = path.join(CONTENT_DIR, data.directory)
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
    const file = files.find(f => f.includes(data.slug))

    if (!file) {
      throw new Error('Post not found')
    }

    const filePath = path.join(dir, file)
    const originalContent = fs.readFileSync(filePath, 'utf-8')

    let content = originalContent
    const changes: string[] = []

    // 1. Remove zero-width Unicode characters
    const zeroWidthChars = content.match(/[\u200B\u200C\u200D\uFEFF\u2060\u00AD]/g)
    if (zeroWidthChars?.length) {
      content = content.replace(/[\u200B\u200C\u200D\uFEFF\u2060\u00AD]/g, '')
      changes.push(`Removed ${zeroWidthChars.length} zero-width characters`)
    }

    // 2. Replace em-dashes with regular dashes or appropriate punctuation
    const emDashes = content.match(/—/g)
    if (emDashes?.length) {
      content = content.replace(/—/g, '-')
      changes.push(`Replaced ${emDashes.length} em-dashes`)
    }

    // 3. Replace en-dashes
    const enDashes = content.match(/–/g)
    if (enDashes?.length) {
      content = content.replace(/–/g, '-')
      changes.push(`Replaced ${enDashes.length} en-dashes`)
    }

    // 4. Remove curly quotes, replace with straight quotes
    const curlyQuotes = content.match(/[""'']/g)
    if (curlyQuotes?.length) {
      content = content.replace(/[""]/g, '"').replace(/['']/g, "'")
      changes.push(`Replaced ${curlyQuotes.length} curly quotes`)
    }

    // 5. Remove non-breaking spaces
    const nbspChars = content.match(/\u00A0/g)
    if (nbspChars?.length) {
      content = content.replace(/\u00A0/g, ' ')
      changes.push(`Replaced ${nbspChars.length} non-breaking spaces`)
    }

    // 6. Remove multiple consecutive empty lines (normalize to max 2)
    const originalLineCount = content.split('\n').length
    content = content.replace(/\n{4,}/g, '\n\n\n')
    const newLineCount = content.split('\n').length
    if (originalLineCount !== newLineCount) {
      changes.push(`Normalized ${originalLineCount - newLineCount} excess newlines`)
    }

    // 7. Remove trailing whitespace on lines
    const lines = content.split('\n')
    let trailingWhitespace = 0
    const cleanedLines = lines.map(line => {
      const trimmed = line.replace(/\s+$/, '')
      if (trimmed !== line) trailingWhitespace++
      return trimmed
    })
    if (trailingWhitespace > 0) {
      content = cleanedLines.join('\n')
      changes.push(`Removed trailing whitespace from ${trailingWhitespace} lines`)
    }

    // Save if changes were made
    if (changes.length > 0) {
      fs.writeFileSync(filePath, content, 'utf-8')
    }

    return {
      success: true,
      changes: changes.length,
      details: changes.length > 0 ? changes : ['No AI watermarks detected']
    }
  })
