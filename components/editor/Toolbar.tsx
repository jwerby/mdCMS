import { useState, useRef, useEffect } from 'react'
import {
  Bold, Italic, Link2, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, Minus, Table,
  ChevronDown, X, Image
} from 'lucide-react'

interface ToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  content: string
  setContent: (content: string) => void
  setIsDirty: (dirty: boolean) => void
  onInsertImage?: () => void
}

interface DropdownItem {
  label: string
  value: string
  icon?: React.ReactNode
}

const codeLanguages: DropdownItem[] = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Bash', value: 'bash' },
  { label: 'SQL', value: 'sql' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Plain Text', value: '' },
]

export function Toolbar({
  textareaRef,
  content,
  setContent,
  setIsDirty,
  onInsertImage,
}: ToolbarProps) {
  const [showCodeDropdown, setShowCodeDropdown] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const codeDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (codeDropdownRef.current && !codeDropdownRef.current.contains(e.target as Node)) {
        setShowCodeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Helper to wrap selected text or insert at cursor
  const wrapSelection = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.slice(start, end)
    const newText = `${before}${selectedText}${after}`
    const newContent = content.slice(0, start) + newText + content.slice(end)

    setContent(newContent)
    setIsDirty(true)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = selectedText ? start + newText.length : start + before.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Helper to insert text at cursor
  const insertAtCursor = (text: string, cursorOffset = 0) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const newContent = content.slice(0, start) + text + content.slice(start)

    setContent(newContent)
    setIsDirty(true)

    setTimeout(() => {
      textarea.focus()
      const newPos = start + text.length + cursorOffset
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // Helper to insert at line start (for headings, lists)
  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const newContent = content.slice(0, lineStart) + prefix + content.slice(lineStart)

    setContent(newContent)
    setIsDirty(true)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    }, 0)
  }

  const handleBold = () => wrapSelection('**', '**')
  const handleItalic = () => wrapSelection('*', '*')
  const handleH1 = () => insertAtLineStart('# ')
  const handleH2 = () => insertAtLineStart('## ')
  const handleH3 = () => insertAtLineStart('### ')
  const handleUnorderedList = () => insertAtLineStart('- ')
  const handleOrderedList = () => insertAtLineStart('1. ')
  const handleBlockquote = () => insertAtLineStart('> ')
  const handleHorizontalRule = () => insertAtCursor('\n---\n')

  const handleCodeBlock = (language: string) => {
    insertAtCursor(`\n\`\`\`${language}\n\n\`\`\`\n`, -5)
    setShowCodeDropdown(false)
  }

  const handleLink = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.slice(start, end)

    setLinkText(selectedText)
    setLinkUrl('')
    setShowLinkModal(true)
  }

  const insertLink = () => {
    const markdown = linkText ? `[${linkText}](${linkUrl})` : `[](${linkUrl})`
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + markdown + content.slice(end)

    setContent(newContent)
    setIsDirty(true)
    setShowLinkModal(false)

    setTimeout(() => {
      textarea.focus()
      if (!linkText) {
        // Position cursor inside the brackets for text entry
        textarea.setSelectionRange(start + 1, start + 1)
      }
    }, 0)
  }

  const insertTable = () => {
    let table = '\n'
    // Header row
    table += '| ' + Array(tableCols).fill('Header').join(' | ') + ' |\n'
    // Separator
    table += '| ' + Array(tableCols).fill('---').join(' | ') + ' |\n'
    // Data rows
    for (let i = 0; i < tableRows - 1; i++) {
      table += '| ' + Array(tableCols).fill('Cell').join(' | ') + ' |\n'
    }
    table += '\n'

    insertAtCursor(table)
    setShowTableModal(false)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
        <button
          type="button"
          onClick={handleBold}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleLink}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Insert Link (Cmd+K)"
        >
          <Link2 className="w-4 h-4" />
        </button>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
        <button
          type="button"
          onClick={handleH1}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleH2}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleH3}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
        <button
          type="button"
          onClick={handleUnorderedList}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleOrderedList}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      {/* Block Elements */}
      <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
        <button
          type="button"
          onClick={handleBlockquote}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleHorizontalRule}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Horizontal Rule"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Code Block with Language Selector */}
      <div className="relative" ref={codeDropdownRef}>
        <button
          type="button"
          onClick={() => setShowCodeDropdown(!showCodeDropdown)}
          className="flex items-center gap-1 p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Code Block"
        >
          <Code className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {showCodeDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[150px]">
            {codeLanguages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => handleCodeBlock(lang.value)}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 first:rounded-t-lg last:rounded-b-lg"
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <button
        type="button"
        onClick={() => setShowTableModal(true)}
        className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
        title="Insert Table"
      >
        <Table className="w-4 h-4" />
      </button>

      {/* Image */}
      {onInsertImage && (
        <button
          type="button"
          onClick={onInsertImage}
          className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
          title="Insert Image"
        >
          <Image className="w-4 h-4" />
        </button>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Insert Link</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Link Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Click here"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowLinkModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                disabled={!linkUrl}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Insert Table</h3>
              <button
                onClick={() => setShowTableModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Columns
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rows
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">Preview:</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      {Array(Math.min(tableCols, 5)).fill(null).map((_, i) => (
                        <th key={i} className="border border-slate-300 px-2 py-1 bg-slate-100">
                          Header
                        </th>
                      ))}
                      {tableCols > 5 && <th className="px-2">...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Array(Math.min(tableRows - 1, 2)).fill(null).map((_, i) => (
                      <tr key={i}>
                        {Array(Math.min(tableCols, 5)).fill(null).map((_, j) => (
                          <td key={j} className="border border-slate-300 px-2 py-1">
                            Cell
                          </td>
                        ))}
                        {tableCols > 5 && <td className="px-2">...</td>}
                      </tr>
                    ))}
                    {tableRows > 3 && (
                      <tr>
                        <td colSpan={Math.min(tableCols, 5)} className="text-center px-2">...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowTableModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={insertTable}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
