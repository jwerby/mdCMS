import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { MarkdownRenderer } from '../MarkdownRenderer'

interface SyncedPreviewProps {
  content: string
  activeBlockIndex: number
  syncEnabled: boolean
}

export interface SyncedPreviewHandle {
  container: HTMLDivElement | null
}

export const SyncedPreview = forwardRef<SyncedPreviewHandle, SyncedPreviewProps>(
  ({ content, activeBlockIndex, syncEnabled }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      container: containerRef.current
    }))

    // Add data-block attributes to rendered elements and handle highlighting
    useEffect(() => {
      if (!containerRef.current) return

      // Use requestAnimationFrame to ensure DOM has settled after React render
      const rafId = requestAnimationFrame(() => {
        try {
          const article = containerRef.current?.querySelector('article')
          if (!article) return

          // Get all direct children of the article (top-level rendered elements)
          const children = Array.from(article.children)

          // Add data-block attributes
          children.forEach((child, index) => {
            if (child.parentNode === article) {
              child.setAttribute('data-block', String(index))
              child.classList.remove('sync-highlight')
            }
          })

          // Highlight active block if sync is enabled
          if (syncEnabled && activeBlockIndex >= 0 && activeBlockIndex < children.length) {
            const activeElement = children[activeBlockIndex]
            if (activeElement && activeElement.parentNode === article) {
              activeElement.classList.add('sync-highlight')

              // Scroll into view smoothly
              activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              })
            }
          }
        } catch {
          // Ignore DOM manipulation errors during rapid content changes
        }
      })

      return () => cancelAnimationFrame(rafId)
    }, [content, activeBlockIndex, syncEnabled])

    return (
      <div ref={containerRef} className="synced-preview">
        <MarkdownRenderer content={content} />

        <style>{`
          .synced-preview [data-block] {
            transition: background-color 0.2s ease, box-shadow 0.2s ease;
            border-radius: 4px;
          }

          .synced-preview [data-block].sync-highlight {
            background-color: rgba(99, 102, 241, 0.08);
            box-shadow: -4px 0 0 rgba(99, 102, 241, 0.5);
            padding-left: 8px;
            margin-left: -8px;
          }

          /* Different highlight styles for different element types */
          .synced-preview h1.sync-highlight,
          .synced-preview h2.sync-highlight,
          .synced-preview h3.sync-highlight,
          .synced-preview h4.sync-highlight,
          .synced-preview h5.sync-highlight,
          .synced-preview h6.sync-highlight {
            background-color: rgba(99, 102, 241, 0.1);
          }

          .synced-preview pre.sync-highlight,
          .synced-preview div:has(> pre).sync-highlight {
            box-shadow: -4px 0 0 rgba(99, 102, 241, 0.7);
          }

          .synced-preview blockquote.sync-highlight {
            box-shadow: none;
            border-left-color: rgb(99, 102, 241);
            background-color: rgba(99, 102, 241, 0.1);
          }
        `}</style>
      </div>
    )
  }
)

SyncedPreview.displayName = 'SyncedPreview'
