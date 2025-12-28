import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronLeft,
  FileText,
  X,
  Sparkles,
  Search,
  ListTree,
  FileEdit,
  Loader2,
  Eye,
  Send,
  Shield,
  Target,
  Wrench,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import {
  getKanbanData,
  createArticle,
  moveArticle,
  removeArticle,
  updateArticle
} from '../../../../server/functions/seo-planner/article-queue'
import {
  generateResearchFromQueue,
  generateOutlineFromQueue,
  generateDraftFromQueue,
  publishFromQueue,
  evaluateExistingDraft,
  checkSEOFromQueue
} from '../../../../server/functions/seo-planner/queue-generation'
import { autoFixSEO } from '../../../../server/functions/seo-planner/seo-auto-fix'
import { requireAuth } from '../../../../lib/auth-utils'
import { useToastStore } from '../../../../lib/store'

type QueueStatus = 'idea' | 'research' | 'outline' | 'draft' | 'published'

interface QueueItem {
  id: number
  title: string
  targetKeywords: string[]
  status: QueueStatus
  priorityScore: number
  category: string | null
  notes: string | null
  instructions: string | null
  estimatedTraffic: number | null
  assignedPostSlug: string | null
  assignedArticleId: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<QueueStatus, { label: string; color: string; bgColor: string }> = {
  idea: { label: 'Ideas', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  research: { label: 'Research', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  outline: { label: 'Outline', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  draft: { label: 'Draft', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  published: { label: 'Published', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' }
}

const STATUSES: QueueStatus[] = ['idea', 'research', 'outline', 'draft', 'published']

export const Route = createFileRoute('/dashboard/seo-planner/queue')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const kanbanData = await getKanbanData()
    return { kanbanData }
  },
  component: QueuePage
})

function QueuePage() {
  const { kanbanData: initialData } = Route.useLoaderData()
  const router = useRouter()
  const { addToast } = useToastStore()

  const [kanbanData, setKanbanData] = useState(initialData)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [evaluatingId, setEvaluatingId] = useState<number | null>(null)
  const [checkingSEOId, setCheckingSEOId] = useState<number | null>(null)
  const [seoResult, setSeoResult] = useState<{ item: QueueItem; seo: any } | null>(null)
  const [evaluationResult, setEvaluationResult] = useState<{ item: QueueItem; evaluation: any; seo: any } | null>(null)
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null)

  const handlePublish = async (item: QueueItem) => {
    setPublishingId(item.id)
    try {
      await publishFromQueue({ data: { articleId: item.id } })
      addToast('Article published!', 'success')
      router.invalidate()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Publish failed', 'error')
    } finally {
      setPublishingId(null)
    }
  }

  const handleGenerate = async (item: QueueItem) => {
    setGeneratingId(item.id)
    try {
      if (item.status === 'idea') {
        await generateResearchFromQueue({ data: { articleId: item.id } })
        addToast('Research generated! Moving to Research.', 'success')
      } else if (item.status === 'research') {
        await generateOutlineFromQueue({ data: { articleId: item.id } })
        addToast('Outline generated! Moving to Outline.', 'success')
      } else if (item.status === 'outline' || item.status === 'draft') {
        const result = await generateDraftFromQueue({ data: { articleId: item.id } })

        // Show draft result with SEO score
        if (result.seo) {
          const seoStatus = result.seo.passFail === 'PASS' ? '✓' : '⚠'
          const issueText = result.seo.issueCount > 0
            ? ` - ${result.seo.issueCount} issue${result.seo.issueCount > 1 ? 's' : ''}`
            : ''
          addToast(
            `Draft generated (${result.wordCount} words). SEO: ${seoStatus} ${result.seo.score}/100${issueText}`,
            result.seo.passFail === 'PASS' ? 'success' : 'info'
          )
        } else {
          addToast(`Draft generated: ${result.wordCount} words`, 'success')
        }
      }
      router.invalidate()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Generation failed', 'error')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleEvaluate = async (item: QueueItem) => {
    setEvaluatingId(item.id)
    try {
      const result = await evaluateExistingDraft({ data: { articleId: item.id } })
      const { evaluation, seo } = result

      // Show detailed results in modal
      setEvaluationResult({ item, evaluation, seo })
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Evaluation failed', 'error')
    } finally {
      setEvaluatingId(null)
    }
  }

  const handleCheckSEO = async (item: QueueItem) => {
    setCheckingSEOId(item.id)
    try {
      const result = await checkSEOFromQueue({ data: { articleId: item.id } })
      const { seo } = result

      // Show detailed results in modal
      setSeoResult({ item, seo })
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'SEO check failed', 'error')
    } finally {
      setCheckingSEOId(null)
    }
  }

  const handleMove = async (item: QueueItem, direction: 'left' | 'right') => {
    const currentIndex = STATUSES.indexOf(item.status)
    const newIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1

    if (newIndex < 0 || newIndex >= STATUSES.length) return

    const newStatus = STATUSES[newIndex]

    try {
      await moveArticle({ data: { id: item.id, status: newStatus } })

      // Update local state
      setKanbanData(prev => {
        const newData = { ...prev }
        newData[item.status] = newData[item.status].filter(i => i.id !== item.id)
        newData[newStatus] = [...newData[newStatus], { ...item, status: newStatus }]
        return newData
      })

      addToast(`Moved to ${STATUS_CONFIG[newStatus].label}`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to move item', 'error')
    }
  }

  const handleDelete = async (item: QueueItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return

    try {
      await removeArticle({ data: { id: item.id } })
      setKanbanData(prev => ({
        ...prev,
        [item.status]: prev[item.status].filter(i => i.id !== item.id)
      }))
      addToast('Article removed', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    }
  }

  const handleAdd = async (title: string, keywords: string[]) => {
    try {
      const result = await createArticle({
        data: {
          title,
          targetKeywords: keywords,
          status: 'idea'
        }
      })

      // Refresh data
      router.invalidate()
      setShowAddModal(false)
      addToast('Article added to queue', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add article', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/seo-planner" className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Article Queue</h1>
                <p className="text-sm text-slate-500">
                  Manage your content pipeline
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Add Article
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {STATUSES.map(status => (
            <div
              key={status}
              className={`w-72 flex-shrink-0 rounded-xl border ${STATUS_CONFIG[status].bgColor}`}
            >
              <div className="p-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${STATUS_CONFIG[status].color}`}>
                    {STATUS_CONFIG[status].label}
                  </h3>
                  <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">
                    {kanbanData[status].length}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-3 min-h-[200px]">
                {kanbanData[status].map(item => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    onMoveLeft={() => handleMove(item, 'left')}
                    onMoveRight={() => handleMove(item, 'right')}
                    onDelete={() => handleDelete(item)}
                    onEdit={() => setEditingItem(item)}
                    onGenerate={() => handleGenerate(item)}
                    onPublish={() => handlePublish(item)}
                    onEvaluate={() => handleEvaluate(item)}
                    onCheckSEO={() => handleCheckSEO(item)}
                    onPreview={() => setPreviewItem(item)}
                    isFirst={status === 'idea'}
                    isLast={status === 'published'}
                    isGenerating={generatingId === item.id}
                    isPublishing={publishingId === item.id}
                    isEvaluating={evaluatingId === item.id}
                    isCheckingSEO={checkingSEOId === item.id}
                  />
                ))}

                {kanbanData[status].length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No items
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <AddArticleModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <EditArticleModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (updates) => {
            try {
              await updateArticle({ data: { id: editingItem.id, ...updates } })
              router.invalidate()
              setEditingItem(null)
              addToast('Article updated', 'success')
            } catch (err) {
              addToast(err instanceof Error ? err.message : 'Failed to update', 'error')
            }
          }}
        />
      )}

      {/* Preview Modal */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* SEO Results Modal */}
      {seoResult && (
        <SEOResultsModal
          item={seoResult.item}
          seo={seoResult.seo}
          onClose={() => setSeoResult(null)}
          onUpdate={(newSeo) => setSeoResult(prev => prev ? { ...prev, seo: newSeo } : null)}
        />
      )}

      {/* Evaluation Results Modal */}
      {evaluationResult && (
        <EvaluationResultsModal
          item={evaluationResult.item}
          evaluation={evaluationResult.evaluation}
          seo={evaluationResult.seo}
          onClose={() => setEvaluationResult(null)}
        />
      )}
    </div>
  )
}

function KanbanCard({
  item,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onEdit,
  onGenerate,
  onPublish,
  onEvaluate,
  onCheckSEO,
  onPreview,
  isFirst,
  isLast,
  isGenerating,
  isPublishing,
  isEvaluating,
  isCheckingSEO
}: {
  item: QueueItem
  onMoveLeft: () => void
  onMoveRight: () => void
  onDelete: () => void
  onEdit: () => void
  onGenerate: () => void
  onPublish: () => void
  onEvaluate: () => void
  onCheckSEO: () => void
  onPreview: () => void
  isFirst: boolean
  isLast: boolean
  isGenerating: boolean
  isPublishing: boolean
  isEvaluating: boolean
  isCheckingSEO: boolean
}) {
  const getGenerateAction = () => {
    switch (item.status) {
      case 'idea':
        return { label: 'Research', icon: Search, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' }
      case 'research':
        return { label: 'Outline', icon: ListTree, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' }
      case 'outline':
        return { label: 'Draft', icon: FileEdit, color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' }
      case 'draft':
        return { label: 'Draft (Regenerate)', icon: FileEdit, color: 'text-green-600 bg-green-50 hover:bg-green-100' }
      default:
        return null
    }
  }

  const generateAction = getGenerateAction()

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-800 text-sm truncate">
            {item.title}
          </h4>

          {item.targetKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.targetKeywords.slice(0, 3).map((kw, i) => (
                <span
                  key={i}
                  className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                >
                  {kw}
                </span>
              ))}
              {item.targetKeywords.length > 3 && (
                <span className="text-xs text-slate-400">
                  +{item.targetKeywords.length - 3}
                </span>
              )}
            </div>
          )}

          {item.estimatedTraffic && (
            <p className="text-xs text-slate-500 mt-2">
              Est. traffic: {item.estimatedTraffic.toLocaleString()}
            </p>
          )}

          {item.priorityScore > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(100, item.priorityScore)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{item.priorityScore.toFixed(0)}</span>
            </div>
          )}

          {/* AI Generate Button */}
          {generateAction && (
            <button
              onClick={onGenerate}
              disabled={isGenerating || isPublishing}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${generateAction.color} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {generateAction.label}
                </>
              )}
            </button>
          )}

          {/* Check SEO Button - only for drafts with linked post */}
          {item.status === 'draft' && (item.assignedArticleId || item.assignedPostSlug) && (
            <button
              onClick={onCheckSEO}
              disabled={isCheckingSEO || isGenerating || isPublishing || isEvaluating}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingSEO ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking SEO...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Check SEO
                </>
              )}
            </button>
          )}

          {/* Evaluate Button - only for drafts with linked post */}
          {item.status === 'draft' && (item.assignedArticleId || item.assignedPostSlug) && (
            <button
              onClick={onEvaluate}
              disabled={isEvaluating || isGenerating || isPublishing || isCheckingSEO}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Evaluate Draft
                </>
              )}
            </button>
          )}

          {/* Publish Button - only for drafts with linked post */}
          {item.status === 'draft' && (item.assignedArticleId || item.assignedPostSlug) && (
            <button
              onClick={onPublish}
              disabled={isPublishing || isGenerating || isEvaluating}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publish
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveLeft}
            disabled={isFirst}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move left"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={onMoveRight}
            disabled={isLast}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move right"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {item.notes && (
            <button
              onClick={onPreview}
              className="p-1 hover:bg-slate-100 rounded"
              title="View notes"
            >
              <Eye className="w-4 h-4 text-indigo-500" />
            </button>
          )}
          {(item.assignedArticleId || item.assignedPostSlug) && (
            <Link
              to="/dashboard/editor/$slug"
              params={{ slug: item.assignedArticleId || item.assignedPostSlug! }}
              className="p-1 hover:bg-slate-100 rounded"
              title="Edit draft"
            >
              <FileText className="w-4 h-4 text-green-500" />
            </Link>
          )}
          <button
            onClick={onEdit}
            className="p-1 hover:bg-slate-100 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-50 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddArticleModal({
  onClose,
  onAdd
}: {
  onClose: () => void
  onAdd: (title: string, keywords: string[]) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsAdding(true)
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
    await onAdd(title.trim(), keywordList)
    setIsAdding(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Add Article</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Article title..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target Keywords
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="keyword1, keyword2, keyword3"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">Separate with commas</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isAdding}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : 'Add Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditArticleModal({
  item,
  onClose,
  onSave
}: {
  item: QueueItem
  onClose: () => void
  onSave: (updates: { title?: string; targetKeywords?: string[]; notes?: string; instructions?: string }) => Promise<void>
}) {
  const [title, setTitle] = useState(item.title)
  const [keywords, setKeywords] = useState(item.targetKeywords.join(', '))
  const [notes, setNotes] = useState(item.notes || '')
  const [instructions, setInstructions] = useState(item.instructions || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSaving(true)
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
    await onSave({
      title: title.trim(),
      targetKeywords: keywordList,
      notes: notes.trim() || undefined,
      instructions: instructions.trim() || undefined
    })
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Edit Article</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target Keywords
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Research Instructions
              <span className="ml-1 text-xs text-slate-400 font-normal">(passed to AI)</span>
            </label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add specific research instructions for AI generation...&#10;&#10;Example: Research and include direct links to Virginia Beach city business licensing, VA state business registration, and federal SBA resources. Verify all URLs are current and working."
            />
            <p className="mt-1 text-xs text-slate-500">
              These instructions persist and are included in all AI generation steps (research, outline, draft).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
              <span className="ml-1 text-xs text-slate-400 font-normal">(internal)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add internal notes (also stores generated research & outlines)..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreviewModal({
  item,
  onClose
}: {
  item: QueueItem
  onClose: () => void
}) {
  const STATUS_LABELS: Record<string, string> = {
    idea: 'Idea',
    research: 'Research',
    outline: 'Outline',
    draft: 'Draft',
    published: 'Published'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {STATUS_LABELS[item.status]}
              </span>
              {item.targetKeywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                  {kw}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {item.notes ? (
            <div className="prose prose-sm prose-slate max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 p-4 rounded-lg">
                {item.notes}
              </pre>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">
              No notes or generated content yet.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

interface SEOCheck {
  name: string
  passed: boolean
  score: number
  message: string
  suggestion?: string
}

function SEOResultsModal({
  item,
  seo,
  onClose,
  onUpdate
}: {
  item: QueueItem
  seo: {
    score: number
    passFail: 'PASS' | 'FAIL'
    checks: SEOCheck[]
    summary: string
  }
  onClose: () => void
  onUpdate?: (newSeo: any) => void
}) {
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{
    fixed: string[]
    skipped: string[]
    oldScore: number
    newScore: number
  } | null>(null)
  const { addToast } = useToastStore()

  const passedChecks = seo.checks.filter(c => c.passed)
  const failedChecks = seo.checks.filter(c => !c.passed)

  const handleAutoFix = async () => {
    setIsFixing(true)
    try {
      const result = await autoFixSEO({ data: { articleId: item.id } })
      setFixResult({
        fixed: result.fixed,
        skipped: result.skipped,
        oldScore: result.oldScore,
        newScore: result.newScore
      })
      if (onUpdate) {
        onUpdate(result.seo)
      }
      addToast(`SEO improved: ${result.oldScore} → ${result.newScore}/100`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Auto-fix failed', 'error')
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">SEO Analysis</h2>
            <p className="text-sm text-slate-500 truncate max-w-md">{item.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg font-bold text-lg ${
              seo.passFail === 'PASS'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {seo.score}/100
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Failed Checks - Show First */}
          {failedChecks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
                Issues to Fix ({failedChecks.length})
              </h3>
              <div className="space-y-2">
                {failedChecks.map((check, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-red-800">{check.name}</span>
                      <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">
                        {check.score}/100
                      </span>
                    </div>
                    <p className="text-sm text-red-700">{check.message}</p>
                    {check.suggestion && (
                      <p className="text-sm text-red-600 mt-1 font-medium">
                        → {check.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed Checks */}
          {passedChecks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs">✓</span>
                Passing ({passedChecks.length})
              </h3>
              <div className="space-y-1">
                {passedChecks.map((check, i) => (
                  <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-green-800 text-sm">{check.name}</span>
                      <span className="text-xs text-green-600 ml-2">{check.message}</span>
                    </div>
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                      {check.score}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fix Results */}
          {fixResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Auto-Fix Complete: {fixResult.oldScore} → {fixResult.newScore}/100
              </h3>
              {fixResult.fixed.length > 0 && (
                <ul className="text-sm text-green-700 space-y-1 mb-2">
                  {fixResult.fixed.map((fix, i) => (
                    <li key={i}>✓ {fix}</li>
                  ))}
                </ul>
              )}
              {fixResult.skipped.length > 0 && (
                <ul className="text-sm text-amber-600 space-y-1">
                  {fixResult.skipped.map((skip, i) => (
                    <li key={i}>⚠ {skip}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tips for 90+ Score */}
          {!fixResult && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-indigo-800 mb-2">Tips for 90+ Score</h3>
              <ul className="text-sm text-indigo-700 space-y-1">
                <li>• Ensure primary keyword appears in title, H1, meta description, and first 150 words</li>
                <li>• Keep meta title 50-60 chars, meta description 150-160 chars</li>
                <li>• Add 2-5 internal links to related content</li>
                <li>• Include 1-3 external links to authoritative sources</li>
                <li>• Use bullet lists and bold text for scannability</li>
                <li>• Target 1,500-3,000 words for comprehensive coverage</li>
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            Score weights: Keyword Placement (1.5x), Meta Tags (1.2x), Structure (1.0x)
          </p>
          <div className="flex gap-2">
            {failedChecks.length > 0 && !fixResult && (
              <button
                onClick={handleAutoFix}
                disabled={isFixing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    Auto-Fix SEO
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EvaluationScore {
  name: string
  score: number
  issues: string[]
  weight: 'critical' | 'high' | 'normal'
}

function EvaluationResultsModal({
  item,
  evaluation,
  seo,
  onClose
}: {
  item: QueueItem
  evaluation: {
    readabilityScore: number
    accuracyScore: number
    grammarScore: number
    uniquenessScore: number
    optimizationScore: number
    localAccuracyScore: number
    readabilityIssues: string[]
    hallucinations: string[]
    grammarFixes: string[]
    clichesFound: string[]
    seoMissing: string[]
    localIssues: string[]
    overallScore: number
    passFail: 'PASS' | 'FAIL'
    failReasons: string[]
  }
  seo: {
    score: number
    passFail: 'PASS' | 'FAIL'
    checks: SEOCheck[]
  }
  onClose: () => void
}) {
  const scores: EvaluationScore[] = [
    { name: 'Accuracy', score: evaluation.accuracyScore, issues: evaluation.hallucinations, weight: 'critical' },
    { name: 'Uniqueness', score: evaluation.uniquenessScore, issues: evaluation.clichesFound, weight: 'critical' },
    { name: 'Local Accuracy', score: evaluation.localAccuracyScore, issues: evaluation.localIssues, weight: 'critical' },
    { name: 'Readability', score: evaluation.readabilityScore, issues: evaluation.readabilityIssues, weight: 'high' },
    { name: 'Grammar', score: evaluation.grammarScore, issues: evaluation.grammarFixes, weight: 'normal' },
    { name: 'SEO Structure', score: evaluation.optimizationScore, issues: evaluation.seoMissing, weight: 'normal' },
  ]

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-amber-600 bg-amber-100'
    return 'text-red-600 bg-red-100'
  }

  const getBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500'
    if (score >= 6) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getWeightBadge = (weight: 'critical' | 'high' | 'normal') => {
    switch (weight) {
      case 'critical':
        return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">CRITICAL</span>
      case 'high':
        return <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">HIGH</span>
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Content Evaluation</h2>
            <p className="text-sm text-slate-500 truncate max-w-md">{item.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-lg font-bold text-xl ${
              evaluation.passFail === 'PASS'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {evaluation.passFail === 'PASS' ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  PASS
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  FAIL
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Overall Score */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <div className={`text-4xl font-bold ${getScoreColor(evaluation.overallScore)} px-4 py-2 rounded-lg`}>
              {evaluation.overallScore}/10
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">Overall Content Quality</p>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  seo.passFail === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  SEO: {seo.score}/100
                </span>
              </div>
            </div>
          </div>

          {/* Fail Reasons */}
          {evaluation.failReasons.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Why It Failed
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {evaluation.failReasons.map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Score Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Score Breakdown</h3>
            <div className="space-y-3">
              {scores.map((score, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{score.name}</span>
                      {getWeightBadge(score.weight)}
                    </div>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${getScoreColor(score.score)}`}>
                      {score.score}/10
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${getBarColor(score.score)} transition-all`}
                      style={{ width: `${score.score * 10}%` }}
                    />
                  </div>

                  {/* Issues */}
                  {score.issues.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">Issues found:</p>
                      <ul className="text-sm text-slate-600 space-y-1">
                        {score.issues.slice(0, 3).map((issue, j) => (
                          <li key={j} className="flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                        {score.issues.length > 3 && (
                          <li className="text-xs text-slate-400">
                            +{score.issues.length - 3} more issues
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SEO Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              SEO Summary
            </h3>
            <div className="flex items-center gap-4 mb-3">
              <span className={`text-lg font-bold px-3 py-1 rounded ${
                seo.passFail === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {seo.score}/100
              </span>
              <span className="text-sm text-slate-600">
                {seo.checks.filter(c => c.passed).length}/{seo.checks.length} checks passing
              </span>
            </div>
            {seo.checks.filter(c => !c.passed).length > 0 && (
              <div className="text-sm text-slate-600">
                <p className="text-xs text-slate-500 mb-1">SEO Issues:</p>
                <ul className="space-y-1">
                  {seo.checks.filter(c => !c.passed).slice(0, 3).map((check, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-amber-500">•</span>
                      <span>{check.name}: {check.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-800 mb-2">Next Steps</h3>
            <ul className="text-sm text-indigo-700 space-y-1">
              {evaluation.passFail === 'FAIL' ? (
                <>
                  {evaluation.accuracyScore < 7 && (
                    <li>• Review and fix accuracy issues - verify all facts against sources</li>
                  )}
                  {evaluation.uniquenessScore < 7 && (
                    <li>• Remove AI cliches and make the tone more natural</li>
                  )}
                  {evaluation.localAccuracyScore < 7 && (
                    <li>• Fix Virginia Beach specific terminology (use BPOL, verify local URLs)</li>
                  )}
                  {evaluation.readabilityScore < 6 && (
                    <li>• Break up long paragraphs and improve flow</li>
                  )}
                  <li>• Consider regenerating the draft after fixing critical issues</li>
                </>
              ) : (
                <>
                  <li>• Content quality is good - ready for final review</li>
                  {seo.passFail === 'FAIL' && (
                    <li>• Run SEO Auto-Fix to improve search optimization</li>
                  )}
                  <li>• Consider a final manual review before publishing</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            Critical scores (Accuracy, Uniqueness, Local) must be 7+ to pass
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
