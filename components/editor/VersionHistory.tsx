import { useState, useEffect } from 'react'
import {
  History, X, Clock, Eye, RotateCcw, ChevronRight, Trash2, AlertCircle
} from 'lucide-react'
import {
  getVersionHistory, getVersion, deleteVersion,
  type VersionEntry, type VersionList
} from '../../server/functions/history'

interface VersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  type: 'post' | 'page'
  slug: string
  currentContent: string
  onRestore: (content: string) => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(timestamp)
}

export function VersionHistory({
  isOpen,
  onClose,
  type,
  slug,
  currentContent,
  onRestore
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionList['versions']>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null)
  const [showConfirmRestore, setShowConfirmRestore] = useState(false)

  // Load version history when panel opens
  useEffect(() => {
    if (isOpen) {
      loadVersions()
    }
  }, [isOpen, type, slug])

  async function loadVersions() {
    setLoading(true)
    try {
      const result = await getVersionHistory({ data: { type, slug } })
      setVersions(result.versions)
    } catch (error) {
      console.error('Failed to load version history:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handlePreview(versionId: string) {
    setPreviewLoading(true)
    try {
      const version = await getVersion({ data: { type, slug, versionId } })
      setSelectedVersion(version)
    } catch (error) {
      console.error('Failed to load version:', error)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete(versionId: string) {
    try {
      await deleteVersion({ data: { type, slug, versionId } })
      setVersions(prev => prev.filter(v => v.id !== versionId))
      if (selectedVersion?.id === versionId) {
        setSelectedVersion(null)
      }
      setShowConfirmDelete(null)
    } catch (error) {
      console.error('Failed to delete version:', error)
    }
  }

  function handleRestore() {
    if (selectedVersion) {
      onRestore(selectedVersion.content)
      setShowConfirmRestore(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <History className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Version History</h2>
              <p className="text-xs text-slate-500">
                {versions.length} version{versions.length !== 1 ? 's' : ''} saved
              </p>
              {type === 'post' && slug && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ID: <span className="font-mono">{slug}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List */}
          <div className="w-1/2 border-r border-slate-200 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                  <History className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No versions yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Versions are saved automatically when you save
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''
                    }`}
                    onClick={() => handlePreview(version.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-700">
                            {formatTimeAgo(version.timestamp)}
                          </span>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {version.summary}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDate(version.timestamp)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 flex flex-col bg-slate-50">
            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : selectedVersion ? (
              <>
                {/* Preview Header */}
                <div className="px-4 py-3 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(selectedVersion.timestamp)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedVersion.content.split('\n').length} lines,{' '}
                        {selectedVersion.content.length.toLocaleString()} characters
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowConfirmDelete(selectedVersion.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete this version"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowConfirmRestore(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedVersion.content}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Select a version to preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showConfirmDelete && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl shadow-xl max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Delete Version?</h3>
                  <p className="text-sm text-slate-600">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDelete(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showConfirmDelete)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        {showConfirmRestore && selectedVersion && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl shadow-xl max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-full">
                  <RotateCcw className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Restore Version?</h3>
                  <p className="text-sm text-slate-600">
                    This will replace your current content with the version from{' '}
                    {formatTimeAgo(selectedVersion.timestamp)}.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmRestore(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
