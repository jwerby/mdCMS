import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ArrowLeft, Save, Eye, EyeOff, Wand2, Image as ImageIcon,
  ChevronDown, ChevronUp, Globe, FileText, Cloud, History, Keyboard, BookOpen, Gauge, Link2,
  CheckCircle, XCircle, AlertTriangle, Sparkles, Wrench, X
} from 'lucide-react'
import { getPost, getPostById, updatePost, togglePublish } from '../../../server/functions/posts'
import { runOptimize, applyOptimizationFixes, applyValidationFixes, type ValidationIssue } from '../../../server/functions/ai/optimize'
import { generateSEOMetadata } from '../../../server/functions/ai/generateSEO'
import { updateWithFeedback } from '../../../server/functions/ai/updateWithFeedback'
import { checkSEOBySlug, autoFixSEOBySlug } from '../../../server/functions/seo-planner/seo-auto-fix'
import type { SEOEvaluationResult } from '../../../server/functions/ai/evaluateSEO'
import { requireAuth } from '../../../lib/auth-utils'
import { useToastStore } from '../../../lib/store'
import { calculateStats, formatWordCount, formatReadingTime } from '../../../lib/content-stats'
import { ImageUpload } from '../../../components/editor/ImageUpload'
import { MediaManager } from '../../../components/editor/MediaManager'
import { AIImageGenerator } from '../../../components/editor/AIImageGenerator'
import { RecoveryModal } from '../../../components/editor/RecoveryModal'
import { VersionHistory } from '../../../components/editor/VersionHistory'
import { Toolbar } from '../../../components/editor/Toolbar'
import { ShortcutsPanel } from '../../../components/editor/ShortcutsPanel'
import { SeoPreview } from '../../../components/editor/SeoPreview'
import { DiffModal } from '../../../components/editor/DiffModal'
import { SyncedPreview } from '../../../components/editor/SyncedPreview'
import { AutosaveManager, type AutosaveData } from '../../../lib/autosave'
import { saveVersion } from '../../../server/functions/history'
import { useEditorSync } from '../../../hooks/useEditorSync'
import { parseFrontmatter, serializeFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { getPostEditorFrontmatter, mergePostFrontmatter, type PostEditorFrontmatter } from '../../../lib/markdown/frontmatter-utils'
import { buildSeoSlug } from '../../../lib/seo/seo-slug'

export const Route = createFileRoute('/dashboard/editor/$slug')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async ({ params }) => {
    // Try UUID lookup first if param looks like a UUID or legacy ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.slug)
    const isLegacyId = params.slug.startsWith('legacy-')

    if (isUUID || isLegacyId) {
      try {
        const post = await getPostById({ data: { id: params.slug } })
        return { post }
      } catch {
        // Fall through to slug lookup
      }
    }

    // Fall back to slug lookup
    const post = await getPost({ data: { slug: params.slug } })
    return { post }
  },
  component: EditorPage,
})

function EditorPage() {
  const { post } = Route.useLoaderData()
  const params = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const { addToast } = useToastStore()

  const [content, setContent] = useState('')
  const [rawFrontmatter, setRawFrontmatter] = useState<Record<string, unknown>>({})
  const [frontmatter, setFrontmatter] = useState<PostEditorFrontmatter>({
    meta_title: '',
    meta_description: '',
    primary_keyword: '',
    secondary_keywords: '',
    url_slug: '',
    published_date: '',
    thumbnail: ''
  })
  const [showPreview, setShowPreview] = useState(true)
  const [showFrontmatter, setShowFrontmatter] = useState(false)
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isGeneratingUpdate, setIsGeneratingUpdate] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showAIImageModal, setShowAIImageModal] = useState(false)
  const [showFeaturedImagePicker, setShowFeaturedImagePicker] = useState(false)
  const [showFeaturedImageAI, setShowFeaturedImageAI] = useState(false)

  useEffect(() => {
    if (!post?.id) return
    if (params.slug !== post.id) {
      navigate({ to: '/dashboard/editor/$slug', params: { slug: post.id } })
    }
  }, [params.slug, post?.id, navigate])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
  const [lastLocalSave, setLastLocalSave] = useState<Date | null>(null)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [recoveryData, setRecoveryData] = useState<AutosaveData | null>(null)
  const [serverContent, setServerContent] = useState('')
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false)
  const [showSeoPreview, setShowSeoPreview] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<Awaited<ReturnType<typeof runOptimize>> | null>(null)
  const [isApplyingFixes, setIsApplyingFixes] = useState(false)
  const [isFixingBrandTerms, setIsFixingBrandTerms] = useState(false)
  const [pendingRewrite, setPendingRewrite] = useState<{
    original: string
    newContent: string
    provider: string
  } | null>(null)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [isCheckingSEO, setIsCheckingSEO] = useState(false)
  const [isFixingSEO, setIsFixingSEO] = useState(false)
  const [seoResult, setSeoResult] = useState<{
    seo: SEOEvaluationResult
    fixResult?: {
      fixed: string[]
      skipped: string[]
      oldScore: number
      newScore: number
    }
  } | null>(null)
  const [showSeoModal, setShowSeoModal] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autosaveRef = useRef<AutosaveManager | null>(null)

  // Editor-preview sync
  const { activeBlockIndex } = useEditorSync({
    textareaRef,
    previewRef,
    content,
    enabled: syncEnabled && showPreview
  })

  // Calculate content stats
  const contentStats = useMemo(() => calculateStats(content), [content])

  // Load post content and check for recovery
  useEffect(() => {
    if (post) {
      const { frontmatter: raw, body } = parseFrontmatter(post.content)
      setRawFrontmatter(raw)
      setFrontmatter(getPostEditorFrontmatter(raw))
      setContent(body)
      setServerContent(body)
      setIsDirty(false)

      // Initialize autosave manager
      if (!autosaveRef.current) {
        autosaveRef.current = new AutosaveManager('post', post.id ?? post.slug, () => {
          setLastLocalSave(new Date())
        })
      }

      // Check for recovery data
      const saved = autosaveRef.current.load()
      if (saved && saved.content.trim() !== body.trim()) {
        setRecoveryData(saved)
        setShowRecoveryModal(true)
      }
    }
  }, [post])

  // Start autosave when content changes
  useEffect(() => {
    if (autosaveRef.current && post) {
      autosaveRef.current.start(() => ({
        content,
        frontmatter
      }))
    }

    return () => {
      autosaveRef.current?.stop()
    }
  }, [post, content, frontmatter])

  // Clean up autosave on unmount
  useEffect(() => {
    return () => {
      autosaveRef.current?.stop()
    }
  }, [])

  // Insert text at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setContent(prev => prev + text)
      setIsDirty(true)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + text + content.slice(end)
    setContent(newContent)
    setIsDirty(true)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }, [content])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setShowPreview(p => !p)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        setShowImageModal(true)
      }
      // Cmd+? or Cmd+Shift+/ for shortcuts panel
      if ((e.metaKey || e.ctrlKey) && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault()
        setShowShortcutsPanel(p => !p)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, frontmatter])

  // Handle recovery modal actions
  const handleRecover = () => {
    if (recoveryData) {
      setContent(recoveryData.content)
      if (recoveryData.frontmatter) {
        setFrontmatter(prev => ({
          ...prev,
          ...recoveryData.frontmatter
        }))
      }
      setIsDirty(true)
    }
    setShowRecoveryModal(false)
    setRecoveryData(null)
  }

  const handleDiscardRecovery = () => {
    autosaveRef.current?.clear()
    setShowRecoveryModal(false)
    setRecoveryData(null)
  }

  // Handle version restore
  const handleVersionRestore = (restoredContent: string) => {
    const { frontmatter: raw, body } = parseFrontmatter(restoredContent)
    setRawFrontmatter(raw)
    setFrontmatter(getPostEditorFrontmatter(raw))
    setContent(body)
    setIsDirty(true)
    addToast('Version restored! Remember to save.', 'success')
  }

  const handleSave = async () => {
    if (!post || isSaving) return
    setIsSaving(true)

    const effectiveFrontmatter = {
      ...frontmatter,
      published_date: frontmatter.published_date || new Date().toISOString().split('T')[0]
    }
    const merged = mergePostFrontmatter(rawFrontmatter, effectiveFrontmatter)
    const fullContent = `${serializeFrontmatter(merged)}\n${content}`

    try {
      await updatePost({ data: { slug: post.id ?? post.slug, content: fullContent } })
      // Save version to history
      await saveVersion({ data: { type: 'post', slug: post.id ?? post.slug, content: fullContent } })
      setIsDirty(false)
      setRawFrontmatter(merged)
      // Clear local storage on successful save
      autosaveRef.current?.clear()
      setLastLocalSave(null)
      setServerContent(content)
      addToast('Post saved!', 'success')
    } catch {
      addToast('Failed to save post', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTogglePublish = async () => {
    if (!post) return
    try {
      const result = await togglePublish({ data: { slug: post.id ?? post.slug } })
      addToast(
        result.newStatus === 'published' ? 'Post published!' : 'Post moved to drafts',
        'success'
      )
      router.invalidate()
    } catch {
      addToast('Failed to update post', 'error')
    }
  }

  const handleGenerateSEO = async () => {
    if (!content || isGeneratingSEO) return
    setIsGeneratingSEO(true)

    try {
      // Use AI to generate optimized SEO metadata
      const result = await generateSEOMetadata({
        data: {
          content,
          existingTitle: frontmatter.meta_title,
          existingKeyword: frontmatter.primary_keyword
        }
      })

      const urlSlug = buildSeoSlug(result.primaryKeyword, result.metaTitle, result.secondaryKeywords)

      setFrontmatter(fm => ({
        ...fm,
        meta_title: result.metaTitle || fm.meta_title,
        meta_description: result.metaDescription || fm.meta_description,
        primary_keyword: result.primaryKeyword || fm.primary_keyword,
        secondary_keywords: result.secondaryKeywords.join(', ') || fm.secondary_keywords,
        url_slug: urlSlug || fm.url_slug
      }))

      setIsDirty(true)
      addToast(`SEO metadata generated via ${result.provider}!`, 'success')
    } catch {
      addToast('Failed to generate SEO', 'error')
    } finally {
      setIsGeneratingSEO(false)
    }
  }

  const handleGenerateUpdate = async () => {
    if (!content.trim() || isGeneratingUpdate) return
    const trimmed = feedbackText.trim()
    if (trimmed.length < 5) {
      addToast('Please add more detailed feedback.', 'error')
      return
    }

    setIsGeneratingUpdate(true)

    try {
      const effectiveFrontmatter = {
        ...frontmatter,
        published_date: frontmatter.published_date || new Date().toISOString().split('T')[0]
      }
      const merged = mergePostFrontmatter(rawFrontmatter, effectiveFrontmatter)
      const fullContent = `${serializeFrontmatter(merged)}\n${content}`

      const result = await updateWithFeedback({
        data: {
          content: fullContent,
          feedback: trimmed
        }
      })

      setPendingRewrite({
        original: content,
        newContent: result.content,
        provider: result.provider
      })
      addToast('Update generated. Review changes.', 'success')
    } catch {
      addToast('Failed to generate update', 'error')
    } finally {
      setIsGeneratingUpdate(false)
    }
  }

  const handleOptimize = async () => {
    if (!post || isOptimizing) return
    setIsOptimizing(true)
    setOptimizeResult(null)

    try {
      const result = await runOptimize({
        data: { slug: post.id ?? post.slug, directory: post.directory as 'published' | 'drafts' }
      })
      setOptimizeResult(result)
      addToast(`SEO Score: ${result.overall}/100`, result.overall >= 70 ? 'success' : 'info')
    } catch {
      addToast('Failed to run optimization check', 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleApplyFixes = async () => {
    if (!optimizeResult || isApplyingFixes) return
    setIsApplyingFixes(true)

    try {
      const result = await applyOptimizationFixes({
        data: {
          content,
          recommendations: optimizeResult.recommendations,
          frontmatter: frontmatter as Record<string, string>
        }
      })
      // Show diff modal instead of applying directly
      setPendingRewrite({
        original: content,
        newContent: result.content,
        provider: result.provider
      })
    } catch {
      addToast('Failed to apply fixes', 'error')
    } finally {
      setIsApplyingFixes(false)
    }
  }

  const handleAcceptRewrite = () => {
    if (!pendingRewrite) return
    setContent(pendingRewrite.newContent)
    setIsDirty(true)
    setOptimizeResult(null)
    setPendingRewrite(null)
    addToast('Changes applied. Review and save when ready.', 'success')
  }

  const handleRejectRewrite = () => {
    setPendingRewrite(null)
    addToast('Changes rejected.', 'info')
  }

  const handleFixBrandTerms = async () => {
    if (!optimizeResult || isFixingBrandTerms || optimizeResult.validationIssues.length === 0) return
    setIsFixingBrandTerms(true)

    try {
      const result = await applyValidationFixes({
        data: {
          content,
          issues: optimizeResult.validationIssues
        }
      })
      setContent(result.content)
      setIsDirty(true)
      // Clear validation issues from result since they're fixed
      setOptimizeResult(prev => prev ? { ...prev, validationIssues: [] } : null)
      addToast(`Fixed ${result.fixedCount} brand term issues!`, 'success')
    } catch {
      addToast('Failed to fix brand terms', 'error')
    } finally {
      setIsFixingBrandTerms(false)
    }
  }

  const handleCheckSEO = async () => {
    if (!post || isCheckingSEO) return
    setIsCheckingSEO(true)

    try {
      const result = await checkSEOBySlug({
        data: {
          slug: post.id ?? post.slug,
          directory: post.directory as 'drafts' | 'published'
        }
      })
      setSeoResult({ seo: result.seo })
      setShowSeoModal(true)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to check SEO', 'error')
    } finally {
      setIsCheckingSEO(false)
    }
  }

  const handleAutoFixSEO = async () => {
    if (!post || isFixingSEO) return
    setIsFixingSEO(true)

    try {
      const result = await autoFixSEOBySlug({
        data: {
          slug: post.id ?? post.slug,
          directory: post.directory as 'drafts' | 'published'
        }
      })
      setSeoResult({
        seo: result.seo,
        fixResult: {
          fixed: result.fixed,
          skipped: result.skipped,
          oldScore: result.oldScore,
          newScore: result.newScore
        }
      })
      setShowSeoModal(true)
      // Reload the post content since it was modified on disk
      router.invalidate()
      addToast(`SEO improved: ${result.oldScore} → ${result.newScore}`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to auto-fix SEO', 'error')
    } finally {
      setIsFixingSEO(false)
    }
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Post not found</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="font-medium text-slate-800 truncate max-w-md">{post.title}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`px-2 py-0.5 rounded-full ${
                post.directory === 'published'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {post.directory === 'published' ? 'Published' : 'Draft'}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <BookOpen className="w-3 h-3" />
                {formatWordCount(contentStats.wordCount)} · {formatReadingTime(contentStats.readingTime)}
              </span>
              {isDirty && <span className="text-amber-600">Unsaved changes</span>}
              {lastLocalSave && !isDirty && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Cloud className="w-3 h-3" />
                  Saved locally
                </span>
              )}
              {lastLocalSave && isDirty && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Cloud className="w-3 h-3" />
                  Draft saved
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShortcutsPanel(true)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            title="Keyboard Shortcuts (Cmd+?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowVersionHistory(true)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            title="Version History"
          >
            <History className="w-4 h-4" />
            History
          </button>

          <button
            onClick={() => setShowAIImageModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            title="Generate AI Image"
          >
            <Wand2 className="w-4 h-4" />
            AI Image
          </button>

          <button
            onClick={() => setShowImageModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            title="Insert Image (Cmd+I)"
          >
            <ImageIcon className="w-4 h-4" />
            Image
          </button>

          <div className="flex items-center">
            <button
              onClick={() => setShowPreview(p => !p)}
              className={`flex items-center gap-2 px-3 py-2 rounded-l-lg text-sm border-r border-slate-200 ${
                showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Preview
            </button>
            <button
              onClick={() => setSyncEnabled(s => !s)}
              disabled={!showPreview}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-r-lg text-sm transition-colors ${
                syncEnabled && showPreview
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              } ${!showPreview ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={syncEnabled ? 'Disable scroll sync' : 'Enable scroll sync'}
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleTogglePublish}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              post.directory === 'published'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            {post.directory === 'published' ? (
              <><Globe className="w-4 h-4" /> Published</>
            ) : (
              <><FileText className="w-4 h-4" /> Draft</>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Frontmatter Panel */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowFrontmatter(s => !s)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setShowFrontmatter(s => !s)
            }
          }}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="font-medium">SEO & Metadata</span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSeoPreview(true); }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateSEO(); }}
              disabled={isGeneratingSEO}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
            >
              <Wand2 className="w-3 h-3" />
              {isGeneratingSEO ? 'Generating...' : 'Auto-generate'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleOptimize(); }}
              disabled={isOptimizing}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              <Gauge className="w-3 h-3" />
              {isOptimizing ? 'Analyzing...' : 'Optimize'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCheckSEO(); }}
              disabled={isCheckingSEO}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
            >
              <CheckCircle className="w-3 h-3" />
              {isCheckingSEO ? 'Checking...' : 'Check SEO'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAutoFixSEO(); }}
              disabled={isFixingSEO}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
            >
              <Wrench className="w-3 h-3" />
              {isFixingSEO ? 'Fixing...' : 'Auto-Fix'}
            </button>
            {showFrontmatter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {showFrontmatter && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="seo-meta-title" className="block text-xs font-medium text-slate-600 mb-1">Meta Title</label>
              <input
                id="seo-meta-title"
                name="meta_title"
                type="text"
                value={frontmatter.meta_title}
                onChange={e => { setFrontmatter(fm => ({ ...fm, meta_title: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="seo-url-slug" className="block text-xs font-medium text-slate-600 mb-1">URL Slug</label>
              <input
                id="seo-url-slug"
                name="url_slug"
                type="text"
                value={frontmatter.url_slug}
                onChange={e => { setFrontmatter(fm => ({ ...fm, url_slug: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="seo-meta-description" className="block text-xs font-medium text-slate-600 mb-1">Meta Description</label>
              <textarea
                id="seo-meta-description"
                name="meta_description"
                value={frontmatter.meta_description}
                onChange={e => { setFrontmatter(fm => ({ ...fm, meta_description: e.target.value })); setIsDirty(true); }}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="seo-primary-keyword" className="block text-xs font-medium text-slate-600 mb-1">Primary Keyword</label>
              <input
                id="seo-primary-keyword"
                name="primary_keyword"
                type="text"
                value={frontmatter.primary_keyword}
                onChange={e => { setFrontmatter(fm => ({ ...fm, primary_keyword: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="seo-secondary-keywords" className="block text-xs font-medium text-slate-600 mb-1">Secondary Keywords (comma-separated)</label>
              <input
                id="seo-secondary-keywords"
                name="secondary_keywords"
                type="text"
                value={frontmatter.secondary_keywords}
                onChange={e => { setFrontmatter(fm => ({ ...fm, secondary_keywords: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Featured Image */}
            <div className="col-span-2 mt-2">
              <label className="block text-xs font-medium text-slate-600 mb-2">Featured Image</label>
              <div className="flex gap-4 items-start">
                {/* Thumbnail Preview */}
                <div className="w-48 h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                  {frontmatter.thumbnail ? (
                    <img
                      src={frontmatter.thumbnail}
                      alt="Featured"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowFeaturedImageAI(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                    Generate with AI
                  </button>
                  <button
                    onClick={() => setShowFeaturedImagePicker(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Choose from Library
                  </button>
                  {frontmatter.thumbnail && (
                    <button
                      onClick={() => { setFrontmatter(fm => ({ ...fm, thumbnail: '' })); setIsDirty(true); }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove image
                    </button>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Recommended: 1200×630px
                  </p>
                </div>
              </div>
            </div>

            {/* Optimization Results */}
            {optimizeResult && (
              <div className="col-span-2 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-700">SEO Analysis</h4>
                  <span className={`text-2xl font-bold ${
                    optimizeResult.overall >= 80 ? 'text-green-600' :
                    optimizeResult.overall >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {optimizeResult.overall}/100
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Readability', score: optimizeResult.scores.readability, max: 25 },
                    { label: 'SEO', score: optimizeResult.scores.seo, max: 25 },
                    { label: 'Engagement', score: optimizeResult.scores.engagement, max: 25 },
                    { label: 'Originality', score: optimizeResult.scores.originality, max: 25 },
                  ].map(({ label, score, max }) => (
                    <div key={label} className="text-center">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className={`text-sm font-medium ${
                        (score / max) >= 0.8 ? 'text-green-600' :
                        (score / max) >= 0.6 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {score}/{max}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Validation Issues (Brand Terms) */}
                {optimizeResult.validationIssues.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-amber-800">
                        Brand Term Issues ({optimizeResult.validationIssues.reduce((sum, i) => sum + i.count, 0)} found)
                      </div>
                      <button
                        onClick={handleFixBrandTerms}
                        disabled={isFixingBrandTerms}
                        className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isFixingBrandTerms ? 'Fixing...' : 'Fix All'}
                      </button>
                    </div>
                    <ul className="text-xs text-amber-700 space-y-1">
                      {optimizeResult.validationIssues.slice(0, 5).map((issue, i) => (
                        <li key={i}>
                          <span className="line-through text-amber-600">{issue.found}</span>
                          {' → '}
                          <span className="font-medium text-green-700">{issue.expected}</span>
                          <span className="text-amber-500 ml-1">({issue.count}x)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {optimizeResult.recommendations.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <div className="font-medium mb-1">Top fixes:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {optimizeResult.recommendations.slice(0, 3).map((rec, i) => (
                        <li key={i} className="truncate">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleApplyFixes}
                    disabled={isApplyingFixes || optimizeResult.recommendations.length === 0}
                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApplyingFixes ? 'Applying...' : 'Apply Fixes'}
                  </button>
                  <button
                    onClick={() => setOptimizeResult(null)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Update with Feedback Panel */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setShowFeedbackPanel(s => !s)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="font-medium">Update with Feedback</span>
          {showFeedbackPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFeedbackPanel && (
          <div className="px-4 pb-4">
            <label htmlFor="update-feedback" className="block text-xs font-medium text-slate-600 mb-1">Feedback</label>
            <textarea
              id="update-feedback"
              name="update_feedback"
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what to add, fix, or improve..."
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Be specific about sections, facts, or conclusions you want improved.
              </span>
              <button
                onClick={handleGenerateUpdate}
                disabled={isGeneratingUpdate || feedbackText.trim().length < 5 || !content.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingUpdate ? 'Generating...' : 'Generate Update'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col border-r border-slate-200`}>
          <Toolbar
            textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
            content={content}
            setContent={setContent}
            setIsDirty={setIsDirty}
            onInsertImage={() => setShowImageModal(true)}
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); setIsDirty(true); }}
            className="flex-1 p-4 font-mono text-sm bg-white resize-none focus:outline-none"
            placeholder="Start writing your post in Markdown..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div ref={previewRef} className="w-1/2 overflow-auto bg-white p-6">
            <div className="max-w-prose mx-auto">
              <SyncedPreview
                content={content}
                activeBlockIndex={activeBlockIndex}
                syncEnabled={syncEnabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Media Manager Modal */}
      <MediaManager
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onInsert={(markdown) => {
          insertAtCursor('\n' + markdown + '\n')
          addToast('Image inserted!', 'success')
        }}
      />

      {/* AI Image Generator Modal */}
      <AIImageGenerator
        isOpen={showAIImageModal}
        onClose={() => setShowAIImageModal(false)}
        onInsert={(markdown) => {
          insertAtCursor('\n' + markdown + '\n')
          addToast('AI image inserted!', 'success')
        }}
        postTitle={frontmatter.meta_title || post.title}
        postDescription={frontmatter.meta_description}
      />

      {/* Featured Image AI Generator */}
      <AIImageGenerator
        isOpen={showFeaturedImageAI}
        onClose={() => setShowFeaturedImageAI(false)}
        onInsert={() => {}}
        onSelectUrl={(url) => {
          setFrontmatter(fm => ({ ...fm, thumbnail: url }))
          setIsDirty(true)
          addToast('Featured image set!', 'success')
        }}
        mode="url"
        postTitle={frontmatter.meta_title || post.title}
        postDescription={frontmatter.meta_description}
      />

      {/* Featured Image Picker */}
      <MediaManager
        isOpen={showFeaturedImagePicker}
        onClose={() => setShowFeaturedImagePicker(false)}
        onInsert={() => {}}
        onSelectUrl={(url) => {
          setFrontmatter(fm => ({ ...fm, thumbnail: url }))
          setIsDirty(true)
          addToast('Featured image set!', 'success')
        }}
        mode="url"
      />

      {/* Recovery Modal */}
      <RecoveryModal
        isOpen={showRecoveryModal}
        savedData={recoveryData}
        serverContent={serverContent}
        onRecover={handleRecover}
        onDiscard={handleDiscardRecovery}
      />

      {/* Version History Panel */}
      <VersionHistory
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        type="post"
        slug={post.id ?? post.slug}
        currentContent={content}
        onRestore={handleVersionRestore}
      />

      {/* Keyboard Shortcuts Panel */}
      <ShortcutsPanel
        isOpen={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
      />

      {/* SEO Preview Panel */}
      <SeoPreview
        isOpen={showSeoPreview}
        onClose={() => setShowSeoPreview(false)}
        title={frontmatter.meta_title}
        description={frontmatter.meta_description}
        url={frontmatter.url_slug}
        image={frontmatter.thumbnail}
      />

      {/* Diff Modal for reviewing rewrite changes */}
      <DiffModal
        isOpen={!!pendingRewrite}
        onClose={handleRejectRewrite}
        onAccept={handleAcceptRewrite}
        originalContent={pendingRewrite?.original ?? ''}
        newContent={pendingRewrite?.newContent ?? ''}
        provider={pendingRewrite?.provider}
      />

      {/* SEO Results Modal */}
      {showSeoModal && seoResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">SEO Analysis</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  seoResult.seo.score >= 80 ? 'bg-green-100 text-green-700' :
                  seoResult.seo.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {seoResult.seo.score >= 80 ? 'Excellent' : seoResult.seo.score >= 60 ? 'Good' : 'Needs Work'}
                </span>
              </div>
              <button
                onClick={() => setShowSeoModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Score Display */}
              <div className="flex items-center justify-center mb-6">
                <div className={`text-6xl font-bold ${
                  seoResult.seo.score >= 80 ? 'text-green-600' :
                  seoResult.seo.score >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {seoResult.seo.score}
                </div>
                <span className="text-2xl text-slate-400 ml-2">/100</span>
              </div>

              {/* Fix Results (if auto-fixed) */}
              {seoResult.fixResult && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-emerald-800">
                      Score improved: {seoResult.fixResult.oldScore} → {seoResult.fixResult.newScore}
                    </span>
                  </div>
                  {seoResult.fixResult.fixed.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium text-emerald-700 mb-1">Fixes applied:</div>
                      <ul className="text-sm text-emerald-600 space-y-0.5">
                        {seoResult.fixResult.fixed.map((fix, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            {fix}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {seoResult.fixResult.skipped.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-amber-700 mb-1">Skipped:</div>
                      <ul className="text-sm text-amber-600 space-y-0.5">
                        {seoResult.fixResult.skipped.map((skip, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            {skip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Checks Grid */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 mb-3">SEO Checks</h3>
                {seoResult.seo.checks.map((check, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      check.passed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {check.passed ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={`font-medium ${check.passed ? 'text-green-800' : 'text-red-800'}`}>
                        {check.name}
                      </span>
                      <span className="ml-auto text-sm text-slate-500">
                        {check.weight} pts
                      </span>
                    </div>
                    <p className={`mt-1 text-sm ${check.passed ? 'text-green-700' : 'text-red-700'}`}>
                      {check.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <p className="text-sm text-slate-500">
                {seoResult.seo.checks.filter(c => c.passed).length} of {seoResult.seo.checks.length} checks passed
              </p>
              <div className="flex gap-2">
                {!seoResult.fixResult && seoResult.seo.score < 80 && (
                  <button
                    onClick={() => { setShowSeoModal(false); handleAutoFixSEO(); }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                  >
                    Auto-Fix Issues
                  </button>
                )}
                <button
                  onClick={() => setShowSeoModal(false)}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
