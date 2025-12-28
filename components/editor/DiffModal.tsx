import { X, Check, RotateCcw } from 'lucide-react'
import { diffWords } from 'diff'
import { useMemo } from 'react'

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
  originalContent: string
  newContent: string
  provider?: string
}

export function DiffModal({ isOpen, onClose, onAccept, originalContent, newContent, provider }: DiffModalProps) {
  if (!isOpen) return null

  // Compute word-level diff
  const diffResult = useMemo(() => {
    return diffWords(originalContent, newContent)
  }, [originalContent, newContent])

  // Calculate stats
  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    diffResult.forEach(part => {
      if (part.added) added += part.value.split(/\s+/).filter(Boolean).length
      if (part.removed) removed += part.value.split(/\s+/).filter(Boolean).length
    })
    return { added, removed }
  }, [diffResult])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Review Changes</h2>
            <p className="text-sm text-slate-500">
              <span className="text-green-600">+{stats.added} words added</span>
              {' / '}
              <span className="text-red-600">-{stats.removed} words removed</span>
              {provider && <span className="ml-2 text-slate-400">via {provider}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Diff View */}
        <div className="flex-1 overflow-auto p-6">
          <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diffResult.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-green-100 text-green-800 border-b-2 border-green-300"
                  >
                    {part.value}
                  </span>
                )
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-red-100 text-red-800 line-through opacity-70"
                  >
                    {part.value}
                  </span>
                )
              }
              return <span key={index}>{part.value}</span>
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            Scroll to review all changes before accepting
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              <RotateCcw className="w-4 h-4" />
              Reject Changes
            </button>
            <button
              onClick={onAccept}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg"
            >
              <Check className="w-4 h-4" />
              Accept Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
