import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, Image as ImageIcon, Copy, Trash2, Check, Loader2 } from 'lucide-react'
import { getImages, uploadImage, deleteImage } from '../../server/functions/images'
import { convertToWebp, getWebpFilename } from '../../lib/image-utils'

interface UploadedImage {
  filename: string
  url: string
  size: number
  markdown?: string
}

interface ImageUploadProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
  onSelectUrl?: (url: string) => void  // For selecting URL only (e.g., hero background)
  mode?: 'markdown' | 'url'  // Default is 'markdown'
}

type UploadStatus = 'idle' | 'converting' | 'uploading'

export function ImageUpload({ isOpen, onClose, onInsert, onSelectUrl, mode = 'markdown' }: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getImages()
      setImages(data)
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchImages()
    }
  }, [isOpen, fetchImages])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const uploadPromises = Array.from(files).map(async (file) => {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')

      let blob: Blob
      let filename: string

      if (isSvg) {
        // SVGs are already optimized vectors - don't convert them
        setUploadStatus('uploading')
        blob = file
        // Keep original name but sanitize it
        const safeName = file.name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/-+/g, '-')
        filename = safeName.endsWith('.svg') ? safeName : `${safeName}.svg`
      } else {
        // Step 1: Convert to WebP in browser
        setUploadStatus('converting')
        const result = await convertToWebp(file, {
          maxWidth: 1200,
          quality: 0.8
        })
        blob = result.blob

        // Step 2: Generate filename
        filename = getWebpFilename(file.name)
      }

      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Array.from(new Uint8Array(arrayBuffer))

      // Upload the file
      setUploadStatus('uploading')
      return uploadImage({
        data: {
          filename,
          buffer,
          alreadyConverted: true
        }
      })
    })

    try {
      const results = await Promise.all(uploadPromises)
      setImages(prev => [...results, ...prev])
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploadStatus('idle')
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deleteImage({ data: { filename } })
      setImages(prev => prev.filter(img => img.filename !== filename))
    } catch (error) {
      console.error('Delete error:', error)
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
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Image Manager</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
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
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${dragActive
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploadStatus !== 'idle' ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-600">
                  {uploadStatus === 'converting' ? 'Converting to WebP...' : 'Uploading...'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  <span className="text-indigo-600 font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">JPEG, PNG, WebP, HEIC auto-convert to WebP. SVG kept as-is.</p>
              </div>
            )}
          </div>
        </div>

        {/* Image Gallery */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ImageIcon className="w-12 h-12 mb-2" />
              <p>No images uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {images.map((image) => (
                <div
                  key={image.filename}
                  className="group relative rounded-lg overflow-hidden aspect-video"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (mode === 'url' && onSelectUrl) {
                            onSelectUrl(image.url)
                          } else {
                            onInsert(`![${image.filename}](${image.url})`)
                          }
                          onClose()
                        }}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        title={mode === 'url' ? 'Select image' : 'Insert into post'}
                      >
                        {mode === 'url' ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(image.url)
                        }}
                        className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Copy URL"
                      >
                        {copiedUrl === image.url ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(image.filename)
                        }}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Size badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                    {formatSize(image.size)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
