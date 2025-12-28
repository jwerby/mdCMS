import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X,
  Upload,
  Image as ImageIcon,
  Copy,
  Trash2,
  Check,
  Loader2,
  Search,
  Grid,
  List,
  Filter,
  RefreshCw,
  Edit2,
  Sparkles,
  FolderUp,
  FileImage,
} from 'lucide-react'
import {
  getAllMedia,
  uploadImage,
  deleteMediaItem,
  updateMediaMetadata,
  syncMediaToDatabase,
  getMediaLibraryStats,
} from '../../server/functions/ai-images'

interface MediaItem {
  id: number
  filename: string
  url: string
  source: 'upload' | 'ai-generated' | 'manual'
  mimeType: string
  fileSize: number
  width?: number
  height?: number
  altText?: string
  description?: string
  keywords?: string[]
  originalFilename?: string
  createdAt: string
  updatedAt: string
}

interface MediaManagerProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
  onSelectUrl?: (url: string) => void
  mode?: 'markdown' | 'url'
}

type ViewMode = 'grid' | 'list'
type SourceFilter = 'all' | 'upload' | 'ai-generated' | 'manual'

export function MediaManager({
  isOpen,
  onClose,
  onInsert,
  onSelectUrl,
  mode = 'markdown',
}: MediaManagerProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null)
  const [stats, setStats] = useState<{
    total: number
    bySource: Record<string, number>
    totalSizeFormatted: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getAllMedia({
        data: {
          query: searchQuery || undefined,
          source: sourceFilter,
          limit: 100,
          offset: 0,
        },
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to fetch media:', error)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, sourceFilter])

  const fetchStats = useCallback(async () => {
    try {
      const result = await getMediaLibraryStats()
      setStats({
        total: result.total,
        bySource: result.bySource,
        totalSizeFormatted: result.totalSizeFormatted,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchMedia()
      fetchStats()
    }
  }, [isOpen, fetchMedia, fetchStats])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchMedia()
    }, 300)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, sourceFilter, fetchMedia])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const result = await syncMediaToDatabase()
      console.log('Sync result:', result.message)
      await fetchMedia()
      await fetchStats()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Read file as base64
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1] || '')
          }
        })
        reader.readAsDataURL(file)
        const base64 = await base64Promise

        await uploadImage({
          data: {
            base64,
            mimeType: file.type,
            originalFilename: file.name,
          },
        })
      }
      await fetchMedia()
      await fetchStats()
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.filename}"?`)) return

    try {
      await deleteMediaItem({ data: { id: item.id, deleteFile: true } })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      await fetchStats()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleUpdateMetadata = async (item: MediaItem, updates: { altText?: string; description?: string }) => {
    try {
      await updateMediaMetadata({
        data: {
          id: item.id,
          altText: updates.altText,
          description: updates.description,
        },
      })
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i))
      )
      setEditingItem(null)
    } catch (error) {
      console.error('Update error:', error)
    }
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleUpload(e.dataTransfer.files)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai-generated':
        return <Sparkles className="w-3 h-3" />
      case 'upload':
        return <FolderUp className="w-3 h-3" />
      default:
        return <FileImage className="w-3 h-3" />
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ai-generated':
        return 'AI'
      case 'upload':
        return 'Upload'
      default:
        return 'Manual'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800">Media Library</h2>
            {stats && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{stats.total} items</span>
                <span className="text-slate-300">|</span>
                <span>{stats.totalSizeFormatted}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
              title="Sync existing files to database"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-200 bg-slate-50">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by filename, alt text, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Sources</option>
              <option value="ai-generated">AI Generated</option>
              <option value="upload">Uploads</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-slate-300'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-slate-300'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-4 border-b border-slate-200">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
              ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-600">Uploading and optimizing...</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Upload className="w-6 h-6 text-slate-400" />
                <div className="text-left">
                  <p className="text-sm text-slate-600">
                    <span className="text-indigo-600 font-medium">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-slate-400">
                    Images auto-convert to WebP with AI-generated alt text
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ImageIcon className="w-12 h-12 mb-2" />
              <p>{searchQuery ? 'No matching images found' : 'No images in library'}</p>
              {!searchQuery && (
                <button
                  onClick={handleSync}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Sync existing images to database
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg overflow-hidden aspect-square bg-slate-100"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }}
                >
                  <img
                    src={item.url}
                    alt={item.altText || item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Source Badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded flex items-center gap-1">
                    {getSourceIcon(item.source)}
                    {getSourceLabel(item.source)}
                  </div>

                  {/* Size Badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                    {formatSize(item.fileSize)}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                    {/* Insert Button - Primary Action */}
                    <button
                      onClick={() => {
                        if (mode === 'url' && onSelectUrl) {
                          onSelectUrl(item.url)
                        } else {
                          onInsert(`![${item.altText || item.filename}](${item.url})`)
                        }
                        onClose()
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2 mb-3"
                    >
                      <Check className="w-4 h-4" />
                      {mode === 'url' ? 'Select' : 'Insert'}
                    </button>
                    {/* Secondary Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(item.url)}
                        className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Copy URL"
                      >
                        {copiedUrl === item.url ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Edit metadata"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 py-3 hover:bg-slate-50 px-2 rounded-lg group"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                    <img
                      src={item.url}
                      alt={item.altText || item.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 truncate">{item.filename}</p>
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                        {getSourceIcon(item.source)}
                        {getSourceLabel(item.source)}
                      </span>
                    </div>
                    {item.altText && (
                      <p className="text-sm text-slate-500 truncate">{item.altText}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>{formatSize(item.fileSize)}</span>
                      {item.width && item.height && (
                        <span>
                          {item.width} x {item.height}
                        </span>
                      )}
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        if (mode === 'url' && onSelectUrl) {
                          onSelectUrl(item.url)
                        } else {
                          onInsert(`![${item.altText || item.filename}](${item.url})`)
                        }
                        onClose()
                      }}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {mode === 'url' ? 'Select' : 'Insert'}
                    </button>
                    <button
                      onClick={() => handleCopy(item.url)}
                      className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl === item.url ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="px-6 py-3 border-t border-slate-200 text-sm text-slate-500">
          Showing {items.length} of {total} items
        </div>

        {/* Edit Modal */}
        {editingItem && (
          <EditMetadataModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(updates) => handleUpdateMetadata(editingItem, updates)}
          />
        )}
      </div>
    </div>
  )
}

// Edit Metadata Modal
function EditMetadataModal({
  item,
  onClose,
  onSave,
}: {
  item: MediaItem
  onClose: () => void
  onSave: (updates: { altText?: string; description?: string }) => void
}) {
  const [altText, setAltText] = useState(item.altText || '')
  const [description, setDescription] = useState(item.description || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    await onSave({ altText, description })
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Edit Metadata</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview */}
          <div className="flex items-start gap-4">
            <img
              src={item.url}
              alt={item.altText || item.filename}
              className="w-24 h-24 object-cover rounded-lg"
            />
            <div>
              <p className="font-medium text-slate-800">{item.filename}</p>
              <p className="text-sm text-slate-500">
                {item.width} x {item.height} px
              </p>
            </div>
          </div>

          {/* Alt Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alt Text
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the image for accessibility"
            />
            <p className="text-xs text-slate-400 mt-1">{altText.length}/125 characters</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Additional context about the image"
            />
          </div>

          {/* Keywords */}
          {item.keywords && item.keywords.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Keywords
              </label>
              <div className="flex flex-wrap gap-2">
                {item.keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-slate-100 text-slate-600 text-sm rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
