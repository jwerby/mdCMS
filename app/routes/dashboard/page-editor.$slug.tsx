import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ArrowLeft, Save, Eye, EyeOff, Image as ImageIcon, X,
  ChevronDown, ChevronUp, Sparkles, Palette, LayoutGrid,
  MousePointer, Type, Building, Image, Music, Leaf, Mic,
  Heart, Users, ChefHat, FileText, Send, Handshake, Bell, Cloud, History, Keyboard, BookOpen, Link2
} from 'lucide-react'
import { getPage, updatePage, getEnhanceConfig, saveEnhanceConfig, type EnhanceConfig } from '../../../server/functions/pages'
import { calculateStats, formatWordCount, formatReadingTime } from '../../../lib/content-stats'
import { requireAuth } from '../../../lib/auth-utils'
import { useToastStore } from '../../../lib/store'
import { ImageUpload } from '../../../components/editor/ImageUpload'
import { MediaManager } from '../../../components/editor/MediaManager'
import { EnhancedPageRenderer } from '../../../components/enhanced/EnhancedPageRenderer'
import { RecoveryModal } from '../../../components/editor/RecoveryModal'
import { VersionHistory } from '../../../components/editor/VersionHistory'
import { Toolbar } from '../../../components/editor/Toolbar'
import { ShortcutsPanel } from '../../../components/editor/ShortcutsPanel'
import { SeoPreview } from '../../../components/editor/SeoPreview'
import { SyncedPreview } from '../../../components/editor/SyncedPreview'
import { AutosaveManager, type AutosaveData } from '../../../lib/autosave'
import { saveVersion } from '../../../server/functions/history'
import { useEditorSync } from '../../../hooks/useEditorSync'
import { parseFrontmatter, serializeFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { getPageEditorFrontmatter, mergePageFrontmatter, type PageEditorFrontmatter } from '../../../lib/markdown/frontmatter-utils'

// Available icons for card grids
const iconOptions = [
  { value: 'building', label: 'Building', Icon: Building },
  { value: 'image', label: 'Image', Icon: Image },
  { value: 'music', label: 'Music', Icon: Music },
  { value: 'leaf', label: 'Leaf', Icon: Leaf },
  { value: 'mic', label: 'Mic', Icon: Mic },
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'users', label: 'Users', Icon: Users },
  { value: 'palette', label: 'Palette', Icon: Palette },
  { value: 'chef-hat', label: 'Chef Hat', Icon: ChefHat },
  { value: 'file-text', label: 'File', Icon: FileText },
  { value: 'send', label: 'Send', Icon: Send },
  { value: 'handshake', label: 'Handshake', Icon: Handshake },
  { value: 'bell', label: 'Bell', Icon: Bell },
]

// Available textures for hero
const textureOptions = [
  { value: '', label: 'None' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'noise', label: 'Noise' },
  { value: 'waves', label: 'Waves' },
]

// Gradient presets
const gradientPresets = [
  { value: 'from-slate-900 to-indigo-900', label: 'Slate to Indigo' },
  { value: 'from-indigo-900 to-purple-900', label: 'Indigo to Purple' },
  { value: 'from-slate-900 to-slate-700', label: 'Slate Dark' },
  { value: 'from-blue-900 to-cyan-800', label: 'Ocean' },
  { value: 'from-emerald-900 to-teal-800', label: 'Forest' },
  { value: 'from-rose-900 to-pink-800', label: 'Rose' },
  { value: 'from-amber-900 to-orange-800', label: 'Sunset' },
]

export const Route = createFileRoute('/dashboard/page-editor/$slug')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async ({ params }) => {
    const page = await getPage({ data: { slug: params.slug } })
    const enhanceConfig = await getEnhanceConfig({ data: { slug: params.slug } })
    return { page, enhanceConfig }
  },
  component: PageEditorPage,
})

function PageEditorPage() {
  const { page, enhanceConfig: initialEnhanceConfig } = Route.useLoaderData()
  const { addToast } = useToastStore()

  const [content, setContent] = useState('')
  const [rawFrontmatter, setRawFrontmatter] = useState<Record<string, unknown>>({})
  const [frontmatter, setFrontmatter] = useState<PageEditorFrontmatter>({
    title: '',
    description: '',
    meta_title: '',
    meta_description: '',
    template: 'default',
    order: 0,
    show_in_nav: false,
    nav_label: ''
  })
  const [enhanceConfig, setEnhanceConfig] = useState<EnhanceConfig | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [showFrontmatter, setShowFrontmatter] = useState(false)
  const [showEnhance, setShowEnhance] = useState(true)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imagePickMode, setImagePickMode] = useState<'markdown' | 'url'>('markdown')
  const [imagePickTarget, setImagePickTarget] = useState<'markdown' | 'background' | 'overlay'>('markdown')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<'markdown' | 'enhanced'>('enhanced')
  const [lastLocalSave, setLastLocalSave] = useState<Date | null>(null)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [recoveryData, setRecoveryData] = useState<AutosaveData | null>(null)
  const [serverContent, setServerContent] = useState('')
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false)
  const [showSeoPreview, setShowSeoPreview] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autosaveRef = useRef<AutosaveManager | null>(null)

  // Editor-preview sync
  const { activeBlockIndex } = useEditorSync({
    textareaRef,
    previewRef,
    content,
    enabled: syncEnabled && showPreview && !enhanceConfig
  })

  // Calculate content stats
  const contentStats = useMemo(() => calculateStats(content), [content])

  // Extract h2 headings from content for section enhancement options
  const sectionHeadings = useMemo(() => {
    const regex = /^## (.+)$/gm
    const headings: string[] = []
    let match
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) headings.push(match[1])
    }
    return headings
  }, [content])

  // Load page content and enhance config
  useEffect(() => {
    if (page) {
      const { frontmatter: raw, body } = parseFrontmatter(page.content)
      setRawFrontmatter(raw)
      setFrontmatter(getPageEditorFrontmatter(raw))
      setContent(body)
      setServerContent(body)
      // Load enhance config
      setEnhanceConfig(initialEnhanceConfig)
      setIsDirty(false)

      // Initialize autosave manager
      if (!autosaveRef.current) {
        autosaveRef.current = new AutosaveManager('page', page.slug, () => {
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
  }, [page, initialEnhanceConfig])

  // Start autosave when content changes
  useEffect(() => {
    if (autosaveRef.current && page) {
      autosaveRef.current.start(() => ({
        content,
        frontmatter
      }))
    }

    return () => {
      autosaveRef.current?.stop()
    }
  }, [page, content, frontmatter])

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
        setImagePickMode('markdown')
        setImagePickTarget('markdown')
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
    setFrontmatter(getPageEditorFrontmatter(raw))
    setContent(body)
    setIsDirty(true)
    addToast('Version restored! Remember to save.', 'success')
  }

  const handleSave = async () => {
    if (!page || isSaving) return
    setIsSaving(true)

    const merged = mergePageFrontmatter(rawFrontmatter, frontmatter)
    const fullContent = `${serializeFrontmatter(merged)}\n${content}`

    try {
      // Save page content
      await updatePage({
        data: {
          slug: page.slug,
          content: fullContent,
          frontmatter: merged
        }
      })
      // Save enhance config
      await saveEnhanceConfig({
        data: {
          slug: page.slug,
          config: enhanceConfig
        }
      })
      // Save version to history
      await saveVersion({ data: { type: 'page', slug: page.slug, content: fullContent } })
      setIsDirty(false)
      setRawFrontmatter(merged)
      // Clear local storage on successful save
      autosaveRef.current?.clear()
      setLastLocalSave(null)
      setServerContent(content)
      addToast('Page saved!', 'success')
    } catch {
      addToast('Failed to save page', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to update enhance config
  const updateEnhance = (updates: Partial<EnhanceConfig>) => {
    setEnhanceConfig(prev => {
      const newConfig = prev ? { ...prev, ...updates } : { ...updates }
      return newConfig
    })
    setIsDirty(true)
  }

  // Helper to update hero config
  const updateHero = (updates: Partial<NonNullable<EnhanceConfig['hero']>>) => {
    setEnhanceConfig(prev => ({
      ...prev,
      hero: { ...prev?.hero, enabled: prev?.hero?.enabled ?? false, ...updates }
    }))
    setIsDirty(true)
  }

  // Helper to get section enhancement
  const getSectionEnhancement = (heading: string) => {
    return enhanceConfig?.enhancements?.find(e => e.target === `## ${heading}`)
  }

  // Helper to set section enhancement type
  const setSectionType = (heading: string, type: string | null) => {
    setEnhanceConfig(prev => {
      const enhancements = [...(prev?.enhancements ?? [])]
      const idx = enhancements.findIndex(e => e.target === `## ${heading}`)

      if (type === null) {
        // Remove enhancement
        if (idx > -1) enhancements.splice(idx, 1)
      } else if (idx > -1) {
        // Update existing
        enhancements[idx] = { ...enhancements[idx], type }
      } else {
        // Add new
        enhancements.push({ target: `## ${heading}`, type })
      }

      return { ...prev, enhancements }
    })
    setIsDirty(true)
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Page not found</div>
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
            <h1 className="font-medium text-slate-800 truncate max-w-md">{page.title}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">/{page.slug}</span>
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
            onClick={() => {
              setImagePickMode('markdown')
              setImagePickTarget('markdown')
              setShowImageModal(true)
            }}
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
              disabled={!showPreview || !!enhanceConfig}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-r-lg text-sm transition-colors ${
                syncEnabled && showPreview && !enhanceConfig
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              } ${!showPreview || enhanceConfig ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={enhanceConfig ? 'Sync disabled in enhanced mode' : syncEnabled ? 'Disable scroll sync' : 'Enable scroll sync'}
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/$slug"
            params={{ slug: page.slug }}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
          >
            <Eye className="w-4 h-4" />
            View
          </Link>

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

      {/* Page Settings Panel */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setShowFrontmatter(s => !s)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="font-medium">Page Settings</span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSeoPreview(true); }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
            >
              <Eye className="w-3 h-3" />
              SEO Preview
            </button>
            {showFrontmatter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showFrontmatter && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Page Title</label>
              <input
                type="text"
                value={frontmatter.title}
                onChange={e => { setFrontmatter(fm => ({ ...fm, title: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Template</label>
              <select
                value={frontmatter.template}
                onChange={e => { setFrontmatter(fm => ({ ...fm, template: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="default">Default</option>
                <option value="landing">Landing Page</option>
                <option value="full-width">Full Width</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea
                value={frontmatter.description}
                onChange={e => { setFrontmatter(fm => ({ ...fm, description: e.target.value })); setIsDirty(true); }}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meta Title (SEO)</label>
              <input
                type="text"
                value={frontmatter.meta_title}
                onChange={e => { setFrontmatter(fm => ({ ...fm, meta_title: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meta Description (SEO)</label>
              <input
                type="text"
                value={frontmatter.meta_description}
                onChange={e => { setFrontmatter(fm => ({ ...fm, meta_description: e.target.value })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={frontmatter.show_in_nav}
                  onChange={e => { setFrontmatter(fm => ({ ...fm, show_in_nav: e.target.checked })); setIsDirty(true); }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show in navigation
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Navigation Label</label>
              <input
                type="text"
                value={frontmatter.nav_label}
                onChange={e => { setFrontmatter(fm => ({ ...fm, nav_label: e.target.value })); setIsDirty(true); }}
                placeholder={frontmatter.title}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
              <input
                type="number"
                value={frontmatter.order}
                onChange={e => { setFrontmatter(fm => ({ ...fm, order: parseInt(e.target.value, 10) || 0 })); setIsDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Visual Enhancements Panel */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setShowEnhance(s => !s)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Visual Enhancements
          </span>
          {showEnhance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showEnhance && (
          <div className="px-4 pb-4 space-y-4 max-h-64 overflow-y-auto">
            {/* Hero Section */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Palette className="w-4 h-4" />
                  Hero Section
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhanceConfig?.hero?.enabled ?? false}
                    onChange={e => updateHero({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {enhanceConfig?.hero?.enabled && (
                <div className="space-y-3">
                  {/* Background Image */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Background Image</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={enhanceConfig?.hero?.backgroundImage ?? ''}
                        onChange={e => updateHero({ backgroundImage: e.target.value || undefined })}
                        placeholder="/content/images/hero.webp"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePickMode('url')
                          setImagePickTarget('background')
                          setShowImageModal(true)
                        }}
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Browse
                      </button>
                    </div>
                    {enhanceConfig?.hero?.backgroundImage && (
                      <div className="mt-2 relative rounded-lg overflow-hidden h-20 bg-slate-100">
                        <img
                          src={enhanceConfig.hero.backgroundImage}
                          alt="Hero preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updateHero({ backgroundImage: undefined })}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Overlay Image (decorative pattern on top) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Overlay Pattern (SVG)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={enhanceConfig?.hero?.overlayImage ?? ''}
                        onChange={e => updateHero({ overlayImage: e.target.value || undefined })}
                        placeholder="/content/images/pattern.svg"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePickMode('url')
                          setImagePickTarget('overlay')
                          setShowImageModal(true)
                        }}
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Browse
                      </button>
                    </div>
                    {enhanceConfig?.hero?.overlayImage && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="relative rounded-lg overflow-hidden h-12 w-20 bg-slate-800">
                          <img
                            src={enhanceConfig.hero.overlayImage}
                            alt="Overlay preview"
                            className="w-full h-full object-cover"
                            style={{ opacity: enhanceConfig?.hero?.overlayOpacity ?? 0.3 }}
                          />
                          <button
                            type="button"
                            onClick={() => updateHero({ overlayImage: undefined, overlayOpacity: undefined })}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">
                            Opacity: {Math.round((enhanceConfig?.hero?.overlayOpacity ?? 0.3) * 100)}%
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={enhanceConfig?.hero?.overlayOpacity ?? 0.3}
                            onChange={e => updateHero({ overlayOpacity: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {enhanceConfig?.hero?.backgroundImage ? 'Overlay' : 'Gradient'}
                      </label>
                      <select
                        value={enhanceConfig?.hero?.backgroundImage
                          ? (enhanceConfig?.hero?.backgroundOverlay ?? 'from-slate-900/80 to-indigo-900/60')
                          : (enhanceConfig?.hero?.gradient ?? 'from-slate-900 to-indigo-900')}
                        onChange={e => {
                          if (enhanceConfig?.hero?.backgroundImage) {
                            updateHero({ backgroundOverlay: e.target.value })
                          } else {
                            updateHero({ gradient: e.target.value })
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {enhanceConfig?.hero?.backgroundImage ? (
                          <>
                            <option value="from-slate-900/80 to-indigo-900/60">Slate to Indigo (Dark)</option>
                            <option value="from-slate-900/50 to-indigo-900/30">Slate to Indigo (Light)</option>
                            <option value="from-black/70 to-black/50">Black Fade</option>
                            <option value="from-black/40 to-black/20">Black Fade (Light)</option>
                            <option value="from-slate-900/90 to-slate-900/70">Slate Dark</option>
                            <option value="from-indigo-900/80 to-purple-900/60">Indigo to Purple</option>
                            <option value="from-transparent to-slate-900/80">Bottom Fade</option>
                            <option value="from-transparent to-transparent">None (No Overlay)</option>
                          </>
                        ) : (
                          gradientPresets.map(g => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Texture</label>
                      <select
                        value={enhanceConfig?.hero?.texture ?? ''}
                        onChange={e => updateHero({ texture: e.target.value as 'dots' | 'grid' | 'diagonal' | 'noise' | 'waves' | undefined })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {textureOptions.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Min Height</label>
                      <select
                        value={enhanceConfig?.hero?.minHeight ?? '70vh'}
                        onChange={e => updateHero({ minHeight: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="50vh">Small (50vh)</option>
                        <option value="70vh">Medium (70vh)</option>
                        <option value="90vh">Large (90vh)</option>
                        <option value="100vh">Full Screen</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhanceConfig?.hero?.includeSubtitle ?? true}
                          onChange={e => updateHero({ includeSubtitle: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Show subtitle
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhanceConfig?.hero?.includeButtons ?? true}
                          onChange={e => updateHero({ includeButtons: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Show buttons
                      </label>
                    </div>
                  </div>

                  {/* Bottom Edge Style */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-medium text-slate-600 mb-2">Bottom Edge Style</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <select
                          value={enhanceConfig?.hero?.bottomStyle ?? 'none'}
                          onChange={e => updateHero({ bottomStyle: e.target.value as 'none' | 'wave' | 'angle' | 'angle-left' | 'curve' | 'fade' })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="none">None (Flat)</option>
                          <option value="angle">Angle (Right)</option>
                          <option value="angle-left">Angle (Left)</option>
                          <option value="curve">Curve</option>
                          <option value="fade">Fade to White</option>
                          <option value="wave">Wave (SVG Overlay)</option>
                        </select>
                      </div>
                      {['angle', 'angle-left', 'curve', 'fade'].includes(enhanceConfig?.hero?.bottomStyle ?? 'none') && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Height: {enhanceConfig?.hero?.bottomHeight ?? 80}px
                          </label>
                          <input
                            type="range"
                            min="40"
                            max="200"
                            step="10"
                            value={enhanceConfig?.hero?.bottomHeight ?? 80}
                            onChange={e => updateHero({ bottomHeight: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grain Texture */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-600">Grain Texture</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhanceConfig?.hero?.showGrain ?? false}
                          onChange={e => updateHero({ showGrain: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    {enhanceConfig?.hero?.showGrain && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Opacity: {Math.round((enhanceConfig?.hero?.grainOpacity ?? 0.15) * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.05"
                          max="0.4"
                          step="0.05"
                          value={enhanceConfig?.hero?.grainOpacity ?? 0.15}
                          onChange={e => updateHero({ grainOpacity: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section Enhancements */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <LayoutGrid className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Section Enhancements</span>
              </div>

              {sectionHeadings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Add ## headings to your content to enhance sections</p>
              ) : (
                <div className="space-y-2">
                  {sectionHeadings.map(heading => {
                    const enhancement = getSectionEnhancement(heading)
                    return (
                      <div key={heading} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <Type className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-700 flex-1 truncate" title={heading}>
                          {heading}
                        </span>
                        <select
                          value={enhancement?.type ?? ''}
                          onChange={e => setSectionType(heading, e.target.value || null)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Default</option>
                          <option value="card-grid">Card Grid</option>
                          <option value="cta-section">CTA Section</option>
                          <option value="cta-banner">CTA Banner</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Preview Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-600">Preview Mode</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setPreviewMode('markdown')}
                  className={`px-3 py-1 text-xs ${previewMode === 'markdown' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setPreviewMode('enhanced')}
                  className={`px-3 py-1 text-xs ${previewMode === 'enhanced' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Enhanced
                </button>
              </div>
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
            onInsertImage={() => {
              setImagePickMode('markdown')
              setImagePickTarget('markdown')
              setShowImageModal(true)
            }}
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); setIsDirty(true); }}
            className="flex-1 p-4 font-mono text-sm bg-white resize-none focus:outline-none"
            placeholder="Start writing your page content in Markdown..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div ref={previewRef} className="w-1/2 overflow-auto bg-white">
            {previewMode === 'enhanced' && enhanceConfig ? (
              <EnhancedPageRenderer content={content} enhanceConfig={enhanceConfig} />
            ) : (
              <div className="p-6">
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
        )}
      </div>

      {/* Media Manager Modal */}
      <MediaManager
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        mode={imagePickMode}
        onInsert={(markdown) => {
          insertAtCursor('\n' + markdown + '\n')
          addToast('Image inserted!', 'success')
        }}
        onSelectUrl={(url) => {
          if (imagePickTarget === 'background') {
            updateHero({ backgroundImage: url })
            addToast('Hero background set!', 'success')
          } else if (imagePickTarget === 'overlay') {
            updateHero({ overlayImage: url })
            addToast('Overlay pattern set!', 'success')
          }
        }}
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
        type="page"
        slug={page.slug}
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
        title={frontmatter.meta_title || frontmatter.title}
        description={frontmatter.meta_description || frontmatter.description}
        url={`/${page.slug}`}
        image={enhanceConfig?.hero?.backgroundImage}
      />
    </div>
  )
}
