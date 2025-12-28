/**
 * Editor-Preview Sync Utilities
 * Parses markdown into blocks and maps cursor positions to block indices
 */

export interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'hr' | 'table' | 'image'
  start: number // character position
  end: number
  lineStart: number
  lineEnd: number
  content: string
}

/**
 * Parse markdown content into blocks
 * Each block represents a top-level element that will be rendered
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = content.split('\n')

  let currentPos = 0
  let lineNum = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const lineStart = currentPos
    const lineStartNum = lineNum

    // Skip empty lines
    if (line.trim() === '') {
      currentPos += line.length + 1
      lineNum++
      i++
      continue
    }

    // Fenced code block
    if (line.match(/^```/)) {
      const startPos = currentPos
      const startLine = lineNum
      let blockContent = line
      currentPos += line.length + 1
      lineNum++
      i++

      // Find closing fence
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        blockContent += '\n' + lines[i]
        currentPos += lines[i].length + 1
        lineNum++
        i++
      }

      // Include closing fence
      if (i < lines.length) {
        blockContent += '\n' + lines[i]
        currentPos += lines[i].length + 1
        lineNum++
        i++
      }

      blocks.push({
        type: 'code',
        start: startPos,
        end: currentPos - 1,
        lineStart: startLine,
        lineEnd: lineNum - 1,
        content: blockContent
      })
      continue
    }

    // Heading
    if (line.match(/^#{1,6}\s/)) {
      blocks.push({
        type: 'heading',
        start: lineStart,
        end: lineStart + line.length,
        lineStart: lineStartNum,
        lineEnd: lineStartNum,
        content: line
      })
      currentPos += line.length + 1
      lineNum++
      i++
      continue
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      blocks.push({
        type: 'hr',
        start: lineStart,
        end: lineStart + line.length,
        lineStart: lineStartNum,
        lineEnd: lineStartNum,
        content: line
      })
      currentPos += line.length + 1
      lineNum++
      i++
      continue
    }

    // Image (standalone)
    if (line.match(/^!\[.*?\]\(.*?\)\s*$/)) {
      blocks.push({
        type: 'image',
        start: lineStart,
        end: lineStart + line.length,
        lineStart: lineStartNum,
        lineEnd: lineStartNum,
        content: line
      })
      currentPos += line.length + 1
      lineNum++
      i++
      continue
    }

    // Blockquote (can span multiple lines)
    if (line.match(/^>\s?/)) {
      const startPos = currentPos
      const startLine = lineNum
      let blockContent = line
      currentPos += line.length + 1
      lineNum++
      i++

      // Continue while lines start with >
      while (i < lines.length && (lines[i].match(/^>\s?/) || (lines[i].trim() !== '' && !lines[i].match(/^[#\-*`]/)))) {
        if (lines[i].trim() === '') break
        blockContent += '\n' + lines[i]
        currentPos += lines[i].length + 1
        lineNum++
        i++
      }

      blocks.push({
        type: 'blockquote',
        start: startPos,
        end: currentPos - 1,
        lineStart: startLine,
        lineEnd: lineNum - 1,
        content: blockContent
      })
      continue
    }

    // List (unordered or ordered)
    if (line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
      const startPos = currentPos
      const startLine = lineNum
      let blockContent = line
      currentPos += line.length + 1
      lineNum++
      i++

      // Continue while lines are list items or indented content
      while (i < lines.length) {
        const nextLine = lines[i]
        if (nextLine.trim() === '') {
          // Check if next non-empty line continues the list
          if (i + 1 < lines.length && lines[i + 1].match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
            blockContent += '\n' + nextLine
            currentPos += nextLine.length + 1
            lineNum++
            i++
            continue
          }
          break
        }
        if (nextLine.match(/^(\s*[-*+]|\s*\d+\.)\s/) || nextLine.match(/^\s{2,}/)) {
          blockContent += '\n' + nextLine
          currentPos += nextLine.length + 1
          lineNum++
          i++
        } else {
          break
        }
      }

      blocks.push({
        type: 'list',
        start: startPos,
        end: currentPos - 1,
        lineStart: startLine,
        lineEnd: lineNum - 1,
        content: blockContent
      })
      continue
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s-:|]+\|?$/)) {
      const startPos = currentPos
      const startLine = lineNum
      let blockContent = line
      currentPos += line.length + 1
      lineNum++
      i++

      // Continue while lines contain |
      while (i < lines.length && lines[i].includes('|')) {
        blockContent += '\n' + lines[i]
        currentPos += lines[i].length + 1
        lineNum++
        i++
      }

      blocks.push({
        type: 'table',
        start: startPos,
        end: currentPos - 1,
        lineStart: startLine,
        lineEnd: lineNum - 1,
        content: blockContent
      })
      continue
    }

    // Paragraph (default - continues until empty line or block element)
    {
      const startPos = currentPos
      const startLine = lineNum
      let blockContent = line
      currentPos += line.length + 1
      lineNum++
      i++

      // Continue until empty line or new block element
      while (i < lines.length) {
        const nextLine = lines[i]
        if (nextLine.trim() === '') break
        if (nextLine.match(/^#{1,6}\s/)) break
        if (nextLine.match(/^```/)) break
        if (nextLine.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) break
        if (nextLine.match(/^>\s?/)) break
        if (nextLine.match(/^(\s*[-*+]|\s*\d+\.)\s/)) break
        if (nextLine.includes('|') && i + 1 < lines.length && lines[i + 1]?.match(/^\|?[\s-:|]+\|?$/)) break

        blockContent += '\n' + nextLine
        currentPos += nextLine.length + 1
        lineNum++
        i++
      }

      blocks.push({
        type: 'paragraph',
        start: startPos,
        end: currentPos - 1,
        lineStart: startLine,
        lineEnd: lineNum - 1,
        content: blockContent
      })
    }
  }

  return blocks
}

/**
 * Get the block index that contains the given cursor position
 */
export function getBlockAtPosition(blocks: MarkdownBlock[], position: number): number {
  for (let i = 0; i < blocks.length; i++) {
    if (position >= blocks[i].start && position <= blocks[i].end) {
      return i
    }
  }

  // If between blocks, find the closest one
  for (let i = 0; i < blocks.length; i++) {
    if (position < blocks[i].start) {
      return Math.max(0, i - 1)
    }
  }

  return blocks.length - 1
}

/**
 * Get block index from line number
 */
export function getBlockAtLine(blocks: MarkdownBlock[], lineNumber: number): number {
  for (let i = 0; i < blocks.length; i++) {
    if (lineNumber >= blocks[i].lineStart && lineNumber <= blocks[i].lineEnd) {
      return i
    }
  }

  // If between blocks, find the closest one
  for (let i = 0; i < blocks.length; i++) {
    if (lineNumber < blocks[i].lineStart) {
      return Math.max(0, i - 1)
    }
  }

  return blocks.length - 1
}

/**
 * Calculate line number from cursor position
 */
export function getLineFromPosition(content: string, position: number): number {
  const textBefore = content.slice(0, position)
  return textBefore.split('\n').length - 1
}
