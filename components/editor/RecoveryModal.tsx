import { AlertCircle, Clock, RotateCcw, Trash2 } from 'lucide-react'
import { formatTimeAgo, type AutosaveData } from '../../lib/autosave'

interface RecoveryModalProps {
  isOpen: boolean
  savedData: AutosaveData | null
  serverContent: string
  onRecover: () => void
  onDiscard: () => void
}

export function RecoveryModal({
  isOpen,
  savedData,
  serverContent,
  onRecover,
  onDiscard
}: RecoveryModalProps) {
  if (!isOpen || !savedData) return null

  // Calculate approximate diff
  const savedLines = savedData.content.split('\n').length
  const serverLines = serverContent.split('\n').length
  const lineDiff = savedLines - serverLines
  const savedChars = savedData.content.length
  const serverChars = serverContent.length
  const charDiff = savedChars - serverChars

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Unsaved Changes Found</h3>
              <p className="text-sm text-slate-600">
                A local draft was found from a previous session
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Draft info */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4" />
              <span>Saved {formatTimeAgo(savedData.savedAt)}</span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>
                Local draft: {savedLines} lines, {savedChars.toLocaleString()} characters
              </div>
              <div>
                Server version: {serverLines} lines, {serverChars.toLocaleString()} characters
              </div>
              {lineDiff !== 0 && (
                <div className={lineDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                  Difference: {lineDiff > 0 ? '+' : ''}{lineDiff} lines, {charDiff > 0 ? '+' : ''}{charDiff} characters
                </div>
              )}
            </div>
          </div>

          {/* Preview snippet */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Draft preview:</p>
            <div className="bg-slate-100 rounded-lg p-3 max-h-32 overflow-y-auto">
              <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">
                {savedData.content.slice(0, 500)}
                {savedData.content.length > 500 && '...'}
              </pre>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Would you like to restore your local draft or discard it and use the server version?
          </p>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Discard Draft
          </button>
          <button
            onClick={onRecover}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Restore Draft
          </button>
        </div>
      </div>
    </div>
  )
}
