import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Save, Plus, Trash2, LayoutGrid, Newspaper, List, LayoutDashboard } from 'lucide-react'
import { getSiteConfig, updateSiteConfig, type SiteConfig, defaultBlogConfig, type BlogTemplate } from '../../../server/functions/site-config'
import { requireAuth } from '../../../lib/auth-utils'
import { useToastStore } from '../../../lib/store'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const config = await getSiteConfig()
    return { config }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { config: initialConfig } = Route.useLoaderData()
  const { addToast } = useToastStore()

  const [config, setConfig] = useState<SiteConfig>(initialConfig)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const updateConfig = (updates: Partial<SiteConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSiteConfig({ data: config })
      setIsDirty(false)
      addToast('Settings saved!', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const addNavLink = () => {
    updateConfig({
      header: {
        ...config.header,
        navigation: [...config.header.navigation, { label: 'New Link', href: '/' }]
      }
    })
  }

  const removeNavLink = (index: number) => {
    updateConfig({
      header: {
        ...config.header,
        navigation: config.header.navigation.filter((_, i) => i !== index)
      }
    })
  }

  const updateNavLink = (index: number, field: 'label' | 'href', value: string) => {
    const updated = [...config.header.navigation]
    updated[index] = { ...updated[index], [field]: value }
    updateConfig({ header: { ...config.header, navigation: updated } })
  }

  const addFooterLink = () => {
    updateConfig({
      footer: {
        ...config.footer,
        links: [...config.footer.links, { label: 'New Link', href: '/' }]
      }
    })
  }

  const removeFooterLink = (index: number) => {
    updateConfig({
      footer: {
        ...config.footer,
        links: config.footer.links.filter((_, i) => i !== index)
      }
    })
  }

  const updateFooterLink = (index: number, field: 'label' | 'href', value: string) => {
    const updated = [...config.footer.links]
    updated[index] = { ...updated[index], [field]: value }
    updateConfig({ footer: { ...config.footer, links: updated } })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Site Settings</h1>
                {isDirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Site Name */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">General</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Site Name</label>
            <input
              type="text"
              value={config.siteName}
              onChange={e => updateConfig({ siteName: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </section>

        {/* Header Settings */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Header</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo Text</label>
                <input
                  type="text"
                  value={config.header.logo.text}
                  onChange={e => updateConfig({
                    header: { ...config.header, logo: { ...config.header.logo, text: e.target.value } }
                  })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo Link</label>
                <input
                  type="text"
                  value={config.header.logo.href}
                  onChange={e => updateConfig({
                    header: { ...config.header, logo: { ...config.header.logo, href: e.target.value } }
                  })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Navigation Links</label>
                <button
                  onClick={addNavLink}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" /> Add Link
                </button>
              </div>
              <div className="space-y-2">
                {config.header.navigation.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={e => updateNavLink(i, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={e => updateNavLink(i, 'href', e.target.value)}
                      placeholder="URL"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => removeNavLink(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.header.showDashboardLink}
                onChange={e => updateConfig({
                  header: { ...config.header, showDashboardLink: e.target.checked }
                })}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Show Dashboard button in header</span>
            </label>
          </div>
        </section>

        {/* Blog Settings */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Blog</h2>
          <div className="space-y-6">
            {/* Template Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Blog Template
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                  { id: 'columns', label: 'Columns', icon: LayoutGrid, desc: '2-3 column grid' },
                  { id: 'cards', label: 'Cards', icon: Newspaper, desc: 'Featured hero + grid' },
                  { id: 'list', label: 'List', icon: List, desc: 'Horizontal rows' },
                  { id: 'mosaic', label: 'Mosaic', icon: LayoutDashboard, desc: 'Pinterest-style' }
                ] as const).map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateConfig({
                      blog: { ...(config.blog ?? defaultBlogConfig), template: id }
                    })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      (config.blog?.template ?? 'columns') === id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${
                      (config.blog?.template ?? 'columns') === id
                        ? 'text-indigo-600'
                        : 'text-slate-400'
                    }`} />
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Posts Per Page */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Posts Per Page: {config.blog?.postsPerPage ?? 12}
              </label>
              <input
                type="range"
                min={4}
                max={24}
                step={4}
                value={config.blog?.postsPerPage ?? 12}
                onChange={e => updateConfig({
                  blog: { ...(config.blog ?? defaultBlogConfig), postsPerPage: Number(e.target.value) }
                })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>4</span>
                <span>12</span>
                <span>24</span>
              </div>
            </div>

            {/* Display Options */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 mb-2">Display Options</label>
              {[
                { key: 'showThumbnail', label: 'Show featured images' },
                { key: 'showExcerpt', label: 'Show post excerpts' },
                { key: 'showDate', label: 'Show publish date' },
                { key: 'showReadTime', label: 'Show estimated read time' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.blog?.[key as keyof typeof config.blog] as boolean ?? true}
                    onChange={e => updateConfig({
                      blog: { ...(config.blog ?? defaultBlogConfig), [key]: e.target.checked }
                    })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>

            {/* Blog Title & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Blog Title</label>
                <input
                  type="text"
                  value={config.blog?.title ?? 'Blog'}
                  onChange={e => updateConfig({
                    blog: { ...(config.blog ?? defaultBlogConfig), title: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <input
                  type="text"
                  value={config.blog?.description ?? ''}
                  onChange={e => updateConfig({
                    blog: { ...(config.blog ?? defaultBlogConfig), description: e.target.value }
                  })}
                  placeholder="Latest articles and insights"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Footer Settings */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Footer</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Copyright Text</label>
              <input
                type="text"
                value={config.footer.copyright}
                onChange={e => updateConfig({
                  footer: { ...config.footer, copyright: e.target.value }
                })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Footer Links</label>
                <button
                  onClick={addFooterLink}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" /> Add Link
                </button>
              </div>
              <div className="space-y-2">
                {config.footer.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={e => updateFooterLink(i, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={e => updateFooterLink(i, 'href', e.target.value)}
                      placeholder="URL"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => removeFooterLink(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.footer.showPoweredBy}
                onChange={e => updateConfig({
                  footer: { ...config.footer, showPoweredBy: e.target.checked }
                })}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Show "Powered by arrival-mdCMS" text</span>
            </label>
          </div>
        </section>
      </main>
    </div>
  )
}
