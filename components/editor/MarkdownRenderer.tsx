import { useMemo, memo } from 'react'
import { ArrowRight, Zap } from 'lucide-react'
import { getSafeUrl, getSafeImageSrc } from '../../lib/security/url-sanitizer'
import { parseInlineText, contentHash } from '../../lib/markdown/inline-parser'

interface MarkdownRendererProps {
  content: string
  showDebug?: boolean
}

// Editor-specific inline styles (slightly different from public renderer)
const EDITOR_INLINE_CLASSES = {
  code: 'bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-[0.9em]',
  link: 'text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 transition-colors',
  bold: 'font-semibold text-slate-900',
  italic: 'italic',
}

// Memoized inline parser with editor-specific styles
const parseInline = (text: string, key: number = 0): React.ReactNode[] => {
  return parseInlineText(text, key, EDITOR_INLINE_CLASSES)
}

function MarkdownRendererComponent({ content, showDebug = false }: MarkdownRendererProps) {
  const start = performance.now()

  const elements = useMemo(() => {
    const lines = content.split('\n')
    const result: React.ReactNode[] = []

    let i = 0
    let isFirstParagraph = true // Track if this is the first paragraph after h1
    let hasPassedH1 = false

    while (i < lines.length) {
      const line = lines[i] ?? ''
      const trimmed = line.trim()

      if (!trimmed) {
        i++
        continue
      }

      // Horizontal Rules
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        result.push(
          <hr key={`hr-${i}`} className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        )
        i++
        continue
      }

      // Code Blocks
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim()
        const codeBlock: string[] = []
        i++
        while (i < lines.length && !lines[i]?.trim().startsWith('```')) {
          codeBlock.push(lines[i] ?? '')
          i++
        }
        i++
        result.push(
          <div key={`code-${i}`} className="my-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            {lang && (
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{lang}</span>
              </div>
            )}
            <pre className="p-5 bg-slate-900 text-slate-200 overflow-x-auto font-mono text-sm leading-relaxed">
              <code>{codeBlock.join('\n')}</code>
            </pre>
          </div>
        )
        continue
      }

      // Breakouts (pull quotes)
      if (trimmed.startsWith('> BREAKOUT:')) {
        result.push(
          <aside key={`breakout-${i}`} className="my-12 py-8 px-6 border-l-4 border-indigo-500 bg-indigo-50 rounded-r-xl">
            <p className="text-xl md:text-2xl text-indigo-900 font-medium italic leading-relaxed">
              {parseInline(trimmed.replace('> BREAKOUT:', '').trim().replace(/^"|"$/g, ''))}
            </p>
          </aside>
        )
        i++
        continue
      }

      // Blockquotes
      if (trimmed.startsWith('> ') && !trimmed.startsWith('> CTA:')) {
        const quoteLines: string[] = []
        while (i < lines.length && lines[i]?.trim().startsWith('> ')) {
          quoteLines.push(lines[i]?.trim().replace(/^>\s*/, '') ?? '')
          i++
        }
        result.push(
          <blockquote key={`quote-${i}`} className="my-8 pl-5 border-l-4 border-slate-300 text-slate-600 italic">
            {quoteLines.map((line, idx) => (
              <p key={idx} className="mb-2 last:mb-0">{parseInline(line)}</p>
            ))}
          </blockquote>
        )
        continue
      }

      // CTAs
      if (trimmed.startsWith('> CTA:')) {
        const title = trimmed.replace('> CTA:', '').trim()
        let description = ''
        let buttonLabel = ''
        let buttonLink = ''

        i++
        if (i < lines.length && lines[i]?.startsWith('>')) {
          description = lines[i]?.replace(/^>\s*/, '').trim() ?? ''
          i++
        }
        if (i < lines.length && lines[i]?.startsWith('>')) {
          const match = lines[i]?.match(/\[(.*?)\]\((.*?)\)/)
          if (match) {
            buttonLabel = match[1] ?? ''
            buttonLink = match[2] ?? ''
          }
          i++
        }

        result.push(
          <div key={`cta-${i}`} className="my-12 p-8 bg-slate-900 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h4 className="text-2xl font-bold mb-2">{parseInline(title)}</h4>
              <p className="text-slate-400">{parseInline(description)}</p>
            </div>
            {buttonLabel && (
              <a href={getSafeUrl(buttonLink)} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap">
                {buttonLabel} <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        )
        continue
      }

      // Images
      const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (imageMatch) {
        const [, alt, src] = imageMatch
        const safeSrc = getSafeImageSrc(src)
        result.push(
          <figure key={`img-${i}`} className="my-10">
            <img
              src={safeSrc}
              alt={alt ?? ''}
              loading="lazy"
              className="w-full rounded-xl shadow-md"
            />
            {alt && <figcaption className="text-center text-sm text-slate-500 mt-3 italic">{alt}</figcaption>}
          </figure>
        )
        i++
        continue
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        hasPassedH1 = true
        isFirstParagraph = true
        result.push(
          <h1 key={`h1-${i}`} className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            {parseInline(trimmed.replace('# ', ''))}
          </h1>
        )
        i++
        continue
      }
      if (trimmed.startsWith('## ')) {
        result.push(
          <h2 key={`h2-${i}`} className="text-2xl md:text-3xl font-bold mt-12 mb-4 text-slate-900 leading-snug">
            {parseInline(trimmed.replace('## ', ''))}
          </h2>
        )
        i++
        continue
      }
      if (trimmed.startsWith('### ')) {
        result.push(
          <h3 key={`h3-${i}`} className="text-xl md:text-2xl font-semibold mt-10 mb-3 text-slate-800 leading-snug">
            {parseInline(trimmed.replace('### ', ''))}
          </h3>
        )
        i++
        continue
      }
      if (trimmed.startsWith('#### ')) {
        result.push(
          <h4 key={`h4-${i}`} className="text-lg font-semibold mt-8 mb-2 text-slate-800">
            {parseInline(trimmed.replace('#### ', ''))}
          </h4>
        )
        i++
        continue
      }

      // Unordered Lists
      if (trimmed.match(/^[-*]\s/)) {
        const items: string[] = []
        while (i < lines.length && lines[i]?.trim().match(/^[-*]\s/)) {
          items.push(lines[i]?.trim().replace(/^[-*]\s/, '') ?? '')
          i++
        }
        result.push(
          <ul key={`ul-${i}`} className="my-6 space-y-2 pl-6">
            {items.map((item, idx) => (
              <li key={idx} className="text-slate-700 leading-relaxed list-disc marker:text-slate-400">
                {parseInline(item)}
              </li>
            ))}
          </ul>
        )
        continue
      }

      // Ordered Lists
      if (trimmed.match(/^\d+\.\s/)) {
        const items: string[] = []
        while (i < lines.length && lines[i]?.trim().match(/^\d+\.\s/)) {
          items.push(lines[i]?.trim().replace(/^\d+\.\s/, '') ?? '')
          i++
        }
        result.push(
          <ol key={`ol-${i}`} className="my-6 space-y-2 pl-6">
            {items.map((item, idx) => (
              <li key={idx} className="text-slate-700 leading-relaxed list-decimal marker:text-slate-500 marker:font-medium">
                {parseInline(item)}
              </li>
            ))}
          </ol>
        )
        continue
      }

      // Tables
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableRows: string[][] = []
        let hasHeader = false

        while (i < lines.length && lines[i]?.trim().startsWith('|') && lines[i]?.trim().endsWith('|')) {
          const rowLine = lines[i]?.trim() ?? ''
          if (rowLine.match(/^\|[\s\-:|]+\|$/)) {
            hasHeader = true
            i++
            continue
          }
          const cells = rowLine.split('|').slice(1, -1).map(cell => cell.trim())
          tableRows.push(cells)
          i++
        }

        if (tableRows.length > 0) {
          const headerRow = hasHeader ? tableRows[0] : null
          const bodyRows = hasHeader ? tableRows.slice(1) : tableRows

          result.push(
            <div key={`table-${i}`} className="my-8 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                {headerRow && (
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {headerRow.map((cell, idx) => (
                        <th key={idx} className="px-4 py-3 text-left font-semibold text-slate-700">
                          {parseInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-100">
                  {bodyRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-3 text-slate-700">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        continue
      }

      // Default Paragraph - with lead paragraph styling for first paragraph after h1
      if (hasPassedH1 && isFirstParagraph) {
        result.push(
          <p key={`p-${i}`} className="text-xl text-slate-700 mb-8 leading-relaxed font-medium">
            {parseInline(trimmed)}
          </p>
        )
        isFirstParagraph = false
      } else {
        result.push(
          <p key={`p-${i}`} className="text-lg text-slate-700 mb-6 leading-[1.8]">
            {parseInline(trimmed)}
          </p>
        )
      }
      i++
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHash(content)])

  const end = performance.now()
  const renderTime = (end - start).toFixed(2)

  return (
    <div className="relative">
      {showDebug && (
        <div className="absolute -top-10 right-0 flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-medium text-slate-500">
          <Zap className="w-3 h-3" /> {renderTime}ms
        </div>
      )}
      <article className="max-w-prose mx-auto">{elements}</article>
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const MarkdownRenderer = memo(MarkdownRendererComponent)
