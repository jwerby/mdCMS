import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Plus, Search, Eye, Edit2, Trash2, Settings, LogOut,
  ArrowUp, ArrowDown, Globe, FileText, Layers,
  X, Image as ImageIcon, Calendar, BarChart3, GripVertical,
  Target, Lightbulb, TrendingUp
} from 'lucide-react'
import {
  getPosts,
  deletePost,
  createPost,
  bulkPublish,
  bulkUnpublish,
  bulkDelete,
  type Post
} from '../../../server/functions/posts'
import {
  getPages,
  createPage,
  deletePage,
  updatePage,
  type Page
} from '../../../server/functions/pages'
import { signOut } from '../../../lib/auth-client'
import { requireAuth } from '../../../lib/auth-utils'
import { useToastStore } from '../../../lib/store'

type FilterStatus = 'all' | 'published' | 'drafts'
type SortField = 'date' | 'title' | 'views' | 'status'
type ActiveTab = 'posts' | 'pages'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: async () => {
    const auth = await requireAuth()
    return { auth }
  },
  loader: async () => {
    const [posts, pages] = await Promise.all([getPosts(), getPages()])
    return { posts, pages }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { posts, pages } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const { addToast } = useToastStore()

  const handleLogout = async () => {
    try {
      await signOut()
      addToast('Logged out successfully', 'success')
      navigate({ to: '/login' })
    } catch {
      addToast('Failed to logout', 'error')
    }
  }

  const [activeTab, setActiveTab] = useState<ActiveTab>('posts')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingPage, setCreatingPage] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDesc, setSortDesc] = useState(true)
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())

  // Filter posts
  let filteredPosts = posts
  if (filter !== 'all') {
    filteredPosts = filteredPosts.filter(p => p.directory === filter)
  }
  if (search) {
    const q = search.toLowerCase()
    filteredPosts = filteredPosts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  }

  // Sort posts
  const filteredAndSortedPosts = [...filteredPosts].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
        break
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'views':
        comparison = (a.views || 0) - (b.views || 0)
        break
      case 'status':
        comparison = a.directory.localeCompare(b.directory)
        break
    }
    return sortDesc ? -comparison : comparison
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc)
    } else {
      setSortField(field)
      setSortDesc(true)
    }
  }

  const toggleSelect = (slug: string) => {
    const newSelected = new Set(selectedSlugs)
    if (newSelected.has(slug)) {
      newSelected.delete(slug)
    } else {
      newSelected.add(slug)
    }
    setSelectedSlugs(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedSlugs.size === filteredAndSortedPosts.length) {
      setSelectedSlugs(new Set())
    } else {
      setSelectedSlugs(new Set(filteredAndSortedPosts.map(p => p.slug)))
    }
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setIsLoading(true)
    try {
      const result = await createPost({ data: { title: newTitle.trim() } })
      if (result.success) {
        addToast('Post created!', 'success')
        setNewTitle('')
        setCreating(false)
        navigate({ to: '/dashboard/editor/$slug', params: { slug: result.id ?? result.slug } })
      }
    } catch {
      addToast('Failed to create post', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await deletePost({ data: { slug } })
      addToast('Post deleted', 'success')
      router.invalidate()
    } catch {
      addToast('Failed to delete post', 'error')
    }
  }

  const handleBulkPublish = async () => {
    if (selectedSlugs.size === 0) return
    try {
      const result = await bulkPublish({ data: { slugs: Array.from(selectedSlugs) } })
      addToast(`Published ${result.published} posts`, 'success')
      setSelectedSlugs(new Set())
      router.invalidate()
    } catch {
      addToast('Failed to publish posts', 'error')
    }
  }

  const handleBulkUnpublish = async () => {
    if (selectedSlugs.size === 0) return
    try {
      const result = await bulkUnpublish({ data: { slugs: Array.from(selectedSlugs) } })
      addToast(`Moved ${result.unpublished} posts to drafts`, 'success')
      setSelectedSlugs(new Set())
      router.invalidate()
    } catch {
      addToast('Failed to unpublish posts', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSlugs.size === 0) return
    if (!confirm(`Delete ${selectedSlugs.size} posts? This cannot be undone.`)) return
    try {
      const result = await bulkDelete({ data: { slugs: Array.from(selectedSlugs) } })
      addToast(`Deleted ${result.deleted} posts`, 'success')
      setSelectedSlugs(new Set())
      router.invalidate()
    } catch {
      addToast('Failed to delete posts', 'error')
    }
  }

  const handleCreatePage = async () => {
    if (!newTitle.trim()) return
    setIsLoading(true)
    try {
      const result = await createPage({ data: { title: newTitle.trim() } })
      if (result.success) {
        addToast('Page created!', 'success')
        setNewTitle('')
        setCreatingPage(false)
        navigate({ to: '/dashboard/page-editor/$slug', params: { slug: result.slug } })
      }
    } catch {
      addToast('Failed to create page', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePage = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await deletePage({ data: { slug } })
      addToast('Page deleted', 'success')
      router.invalidate()
    } catch {
      addToast('Failed to delete page', 'error')
    }
  }

  const publishedCount = posts.filter(p => p.directory === 'published').length
  const draftsCount = posts.filter(p => p.directory === 'drafts').length
  const navPagesCount = pages.filter(p => p.showInNav).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-semibold text-slate-800">Content Dashboard</h1>
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'posts'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Posts
                </button>
                <button
                  onClick={() => setActiveTab('pages')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'pages'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Pages
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/settings"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {activeTab === 'posts' ? (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Post
                </button>
              ) : (
                <button
                  onClick={() => setCreatingPage(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Page
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* SEO Tools Quick Access */}
        <div className="mb-8">
          <Link
            to="/dashboard/seo-planner"
            className="block bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white hover:from-indigo-600 hover:to-purple-700 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">SEO Content Planner</h3>
                  <p className="text-indigo-100 text-sm">
                    Discover keywords, find content gaps, and manage your article pipeline
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full">
                    <Lightbulb className="w-4 h-4" />
                    Ideation
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full">
                    <TrendingUp className="w-4 h-4" />
                    Opportunities
                  </span>
                </div>
                <div className="text-white/80 group-hover:translate-x-1 transition-transform">
                  →
                </div>
              </div>
            </div>
          </Link>
        </div>

        {activeTab === 'posts' ? (
          <>
            {/* Posts Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="text-2xl font-bold text-slate-800">{posts.length}</div>
                <div className="text-sm text-slate-500">Total Posts</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-green-200 bg-green-50">
                <div className="text-2xl font-bold text-green-700">{publishedCount}</div>
                <div className="text-sm text-green-600">Published</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-200 bg-amber-50">
                <div className="text-2xl font-bold text-amber-700">{draftsCount}</div>
                <div className="text-sm text-amber-600">Drafts</div>
              </div>
            </div>

            {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('published')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'published' ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Published
              </button>
              <button
                onClick={() => setFilter('drafts')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'drafts' ? 'bg-amber-100 text-amber-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Drafts
              </button>
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Sort by:</span>
          <div className="flex items-center gap-1">
            <SortButton
              label="Date"
              field="date"
              currentField={sortField}
              desc={sortDesc}
              onClick={() => toggleSort('date')}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            <SortButton
              label="Title"
              field="title"
              currentField={sortField}
              desc={sortDesc}
              onClick={() => toggleSort('title')}
            />
            <SortButton
              label="Views"
              field="views"
              currentField={sortField}
              desc={sortDesc}
              onClick={() => toggleSort('views')}
              icon={<BarChart3 className="w-3.5 h-3.5" />}
            />
            <SortButton
              label="Status"
              field="status"
              currentField={sortField}
              desc={sortDesc}
              onClick={() => toggleSort('status')}
            />
          </div>

          {/* Select All */}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSlugs.size === filteredAndSortedPosts.length && filteredAndSortedPosts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Select all
            </label>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedSlugs.size > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700">
              {selectedSlugs.size} post{selectedSlugs.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPublish}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
              >
                <Globe className="w-4 h-4" />
                Publish
              </button>
              <button
                onClick={handleBulkUnpublish}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
              >
                <FileText className="w-4 h-4" />
                Move to Drafts
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => setSelectedSlugs(new Set())}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Posts Cards */}
        {filteredAndSortedPosts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {search ? 'No posts match your search' : 'No posts yet. Create your first post!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedPosts.map(post => (
              <div
                key={post.slug}
                className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all ${
                  selectedSlugs.has(post.slug)
                    ? 'border-indigo-300 ring-2 ring-indigo-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedSlugs.has(post.slug)}
                      onChange={() => toggleSelect(post.slug)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {post.thumbnail ? (
                      <img
                        src={post.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Status indicator (stoplight) */}
                  <div className={`mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    post.directory === 'published' ? 'bg-green-500' : 'bg-amber-500'
                  }`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 truncate">{post.title}</h3>
                    <p className="text-sm text-slate-500 truncate mt-0.5">{post.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{post.date}</span>
                      <span>{post.views.toLocaleString()} views</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        post.directory === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {post.directory === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Link
                      to="/post/$slug"
                      params={{ slug: post.slug }}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/dashboard/editor/$slug"
                      params={{ slug: post.id ?? post.slug }}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(post.slug, post.title)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        ) : (
          <>
            {/* Pages Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="text-2xl font-bold text-slate-800">{pages.length}</div>
                <div className="text-sm text-slate-500">Total Pages</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-indigo-200 bg-indigo-50">
                <div className="text-2xl font-bold text-indigo-700">{navPagesCount}</div>
                <div className="text-sm text-indigo-600">In Navigation</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="text-2xl font-bold text-slate-800">{pages.length - navPagesCount}</div>
                <div className="text-sm text-slate-500">Hidden</div>
              </div>
            </div>

            {/* Pages List */}
            {pages.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No pages yet. Create your first page!
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((page, index) => (
                  <div
                    key={page.slug}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Order indicator */}
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-xs font-medium">{page.order}</span>
                      </div>

                      {/* Nav indicator */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        page.showInNav ? 'bg-indigo-500' : 'bg-slate-300'
                      }`} title={page.showInNav ? 'In navigation' : 'Hidden'} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800">{page.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span className="font-mono">/{page.slug}</span>
                          {page.showInNav && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              {page.navLabel}
                            </span>
                          )}
                          <span className="text-slate-300">|</span>
                          <span>Template: {page.template}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Link
                          to="/$slug"
                          params={{ slug: page.slug }}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to="/dashboard/page-editor/$slug"
                          params={{ slug: page.slug }}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDeletePage(page.slug, page.title)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Post Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Post</h2>
            <input
              type="text"
              placeholder="Post title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setCreating(false); setNewTitle(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Page Modal */}
      {creatingPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Page</h2>
            <input
              type="text"
              placeholder="Page title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePage()}
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setCreatingPage(false); setNewTitle(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newTitle.trim() || isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortButton({
  label,
  field,
  currentField,
  desc,
  onClick,
  icon
}: {
  label: string
  field: SortField
  currentField: SortField
  desc: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  const isActive = currentField === field

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
      {isActive && (
        desc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
