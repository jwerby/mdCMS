import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  parseMarkdownBlocks,
  getBlockAtPosition,
  getLineFromPosition,
  type MarkdownBlock
} from '../lib/editor-sync'

interface UseEditorSyncOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  previewRef: React.RefObject<HTMLDivElement | null>
  content: string
  enabled: boolean
}

interface UseEditorSyncReturn {
  activeBlockIndex: number
  blocks: MarkdownBlock[]
  scrollToBlock: (index: number) => void
}

export function useEditorSync({
  textareaRef,
  previewRef,
  content,
  enabled
}: UseEditorSyncOptions): UseEditorSyncReturn {
  const [activeBlockIndex, setActiveBlockIndex] = useState(-1)
  const lastScrollTime = useRef(0)

  // Parse blocks when content changes
  const blocks = useMemo(() => {
    if (!enabled || !content) return []
    return parseMarkdownBlocks(content)
  }, [content, enabled])

  // Update active block based on cursor position
  const updateActiveBlock = useCallback(() => {
    if (!enabled || !textareaRef.current || blocks.length === 0) {
      setActiveBlockIndex(-1)
      return
    }

    const position = textareaRef.current.selectionStart
    const blockIndex = getBlockAtPosition(blocks, position)

    if (blockIndex !== activeBlockIndex) {
      setActiveBlockIndex(blockIndex)
    }
  }, [enabled, textareaRef, blocks, activeBlockIndex])

  // Scroll preview to show the active block
  const scrollToBlock = useCallback((index: number) => {
    if (!previewRef.current || index < 0) return

    // Prevent scroll loop
    const now = Date.now()
    if (now - lastScrollTime.current < 100) return
    lastScrollTime.current = now

    // Find the element with the matching data-block attribute
    const element = previewRef.current.querySelector(`[data-block="${index}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [previewRef])

  // Auto-scroll when active block changes
  useEffect(() => {
    if (enabled && activeBlockIndex >= 0) {
      scrollToBlock(activeBlockIndex)
    }
  }, [enabled, activeBlockIndex, scrollToBlock])

  // Listen to cursor position changes
  useEffect(() => {
    if (!enabled) return

    const textarea = textareaRef.current
    if (!textarea) return

    const handleSelectionChange = () => {
      // Small delay to batch rapid changes
      requestAnimationFrame(updateActiveBlock)
    }

    const handleKeyUp = () => {
      requestAnimationFrame(updateActiveBlock)
    }

    const handleMouseUp = () => {
      requestAnimationFrame(updateActiveBlock)
    }

    const handleClick = () => {
      requestAnimationFrame(updateActiveBlock)
    }

    textarea.addEventListener('keyup', handleKeyUp)
    textarea.addEventListener('mouseup', handleMouseUp)
    textarea.addEventListener('click', handleClick)
    textarea.addEventListener('focus', handleSelectionChange)

    // Also listen to document selection change for more accuracy
    const handleDocumentSelection = () => {
      if (document.activeElement === textarea) {
        requestAnimationFrame(updateActiveBlock)
      }
    }
    document.addEventListener('selectionchange', handleDocumentSelection)

    // Initial check
    updateActiveBlock()

    return () => {
      textarea.removeEventListener('keyup', handleKeyUp)
      textarea.removeEventListener('mouseup', handleMouseUp)
      textarea.removeEventListener('click', handleClick)
      textarea.removeEventListener('focus', handleSelectionChange)
      document.removeEventListener('selectionchange', handleDocumentSelection)
    }
  }, [enabled, textareaRef, updateActiveBlock])

  return {
    activeBlockIndex,
    blocks,
    scrollToBlock
  }
}
