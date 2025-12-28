import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Loader2, Image as ImageIcon, Check, RefreshCw, Sparkles, Upload } from 'lucide-react'
import {
  generatePostFeaturedImage,
  generatePostInlineImage,
  generateImageVariants,
  saveGeneratedImage,
  getAIGeneratedImages,
  uploadImage,
  getUploadedImages
} from '../../server/functions/ai-images'

type ImageStyle = 'photorealistic' | 'illustration' | 'digital-art' | 'minimalist' | 'abstract'
type GeneratorTab = 'featured' | 'inline' | 'upload' | 'gallery'

interface GeneratedImageResult {
  base64?: string
  url?: string
  markdown?: string
  mimeType: string
}

interface AIImageGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
  onSelectUrl?: (url: string) => void
  mode?: 'markdown' | 'url'
  postTitle?: string
  postDescription?: string
  selectedText?: string
}

interface GalleryImage {
  filename: string
  url: string
  size: number
  createdAt: string
}

const styleOptions: { value: ImageStyle; label: string; description: string }[] = [
  { value: 'photorealistic', label: 'Photorealistic', description: 'High-quality photograph style' },
  { value: 'illustration', label: 'Illustration', description: 'Modern illustration with clean lines' },
  { value: 'digital-art', label: 'Digital Art', description: 'Contemporary digital design' },
  { value: 'minimalist', label: 'Minimalist', description: 'Clean, simple with white space' },
  { value: 'abstract', label: 'Abstract', description: 'Artistic interpretation' },
]

export function AIImageGenerator({
  isOpen,
  onClose,
  onInsert,
  onSelectUrl,
  mode = 'markdown',
  postTitle = '',
  postDescription = '',
  selectedText = ''
}: AIImageGeneratorProps) {
  const [activeTab, setActiveTab] = useState<GeneratorTab>('featured')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Featured image state
  const [featuredTitle, setFeaturedTitle] = useState(postTitle)
  const [featuredDescription, setFeaturedDescription] = useState(postDescription)
  const [featuredCategory, setFeaturedCategory] = useState('')

  // Inline image state
  const [inlineContext, setInlineContext] = useState(selectedText)
  const [inlineStyle, setInlineStyle] = useState<ImageStyle>('illustration')

  // Generated image state
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null)
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedImageResult[]>([])
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null)

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<{
    url: string
    altText: string
    markdown: string
    originalSize: number
    optimizedSize: number
  } | null>(null)
  const [uploadContext, setUploadContext] = useState('')

  // Update state when props change
  useEffect(() => {
    if (isOpen) {
      setFeaturedTitle(postTitle)
      setFeaturedDescription(postDescription)
      setInlineContext(selectedText)
      setError(null)
      setGeneratedImage(null)
      setGeneratedVariants([])
      setSelectedVariant(null)
      setUploadedImage(null)
      setUploadContext('')
    }
  }, [isOpen, postTitle, postDescription, selectedText])

  // Load gallery when tab changes
  useEffect(() => {
    if (activeTab === 'gallery' && isOpen) {
      loadGallery()
    }
  }, [activeTab, isOpen])

  const loadGallery = async () => {
    setIsLoadingGallery(true)
    try {
      const images = await getAIGeneratedImages()
      setGalleryImages(images)
    } catch (err) {
      console.error('Failed to load gallery:', err)
    } finally {
      setIsLoadingGallery(false)
    }
  }

  const handleGenerateFeatured = async () => {
    if (!featuredTitle.trim()) {
      setError('Please enter a title for the image')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedImage(null)

    try {
      const result = await generatePostFeaturedImage({
        data: {
          title: featuredTitle,
          description: featuredDescription || undefined,
          category: featuredCategory || undefined,
          save: true
        }
      })

      if (result.success) {
        setGeneratedImage({
          url: result.url,
          markdown: result.markdown,
          mimeType: result.mimeType || 'image/png'
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateInline = async () => {
    if (!inlineContext.trim()) {
      setError('Please enter a context or description for the image')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedImage(null)

    try {
      const result = await generatePostInlineImage({
        data: {
          context: inlineContext,
          style: inlineStyle,
          save: true
        }
      })

      if (result.success) {
        setGeneratedImage({
          url: result.url,
          markdown: result.markdown,
          mimeType: result.mimeType || 'image/png'
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateVariants = async () => {
    const prompt = activeTab === 'featured' ? featuredTitle : inlineContext
    if (!prompt.trim()) {
      setError('Please enter a prompt first')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedVariants([])
    setSelectedVariant(null)

    try {
      const result = await generateImageVariants({
        data: {
          prompt,
          count: 3
        }
      })

      if (result.success && result.images) {
        setGeneratedVariants(result.images.map(img => ({
          base64: img.base64,
          mimeType: img.mimeType
        })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variants')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveVariant = async (index: number) => {
    const variant = generatedVariants[index]
    if (!variant?.base64) return

    setIsSaving(true)
    try {
      const result = await saveGeneratedImage({
        data: {
          base64: variant.base64,
          prefix: activeTab === 'featured' ? 'featured' : 'inline',
          altText: activeTab === 'featured' ? featuredTitle : inlineContext.substring(0, 100)
        }
      })

      if (result.success) {
        setGeneratedImage({
          url: result.url,
          markdown: result.markdown,
          mimeType: 'image/png'
        })
        setGeneratedVariants([])
        setSelectedVariant(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInsert = () => {
    if (generatedImage?.markdown) {
      onInsert(generatedImage.markdown)
      onClose()
    } else if (generatedImage?.url) {
      if (mode === 'url' && onSelectUrl) {
        onSelectUrl(generatedImage.url)
      } else {
        const altText = activeTab === 'featured' ? featuredTitle : inlineContext.substring(0, 50)
        onInsert(`![${altText}](${generatedImage.url})`)
      }
      onClose()
    }
  }

  const handleInsertGalleryImage = (image: GalleryImage) => {
    if (mode === 'url' && onSelectUrl) {
      onSelectUrl(image.url)
    } else {
      onInsert(`![${image.filename}](${image.url})`)
    }
    onClose()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadedImage(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64Data = result.split(',')[1] || ''
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload with AI analysis
      const result = await uploadImage({
        data: {
          base64,
          mimeType: file.type,
          originalFilename: file.name,
          context: uploadContext || postTitle || undefined,
        }
      })

      if (result.success) {
        setUploadedImage({
          url: result.url,
          altText: result.altText,
          markdown: result.markdown,
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleInsertUploadedImage = () => {
    if (uploadedImage) {
      if (mode === 'url' && onSelectUrl) {
        onSelectUrl(uploadedImage.url)
      } else {
        onInsert(uploadedImage.markdown)
      }
      onClose()
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">AI Image Generator</h2>
              <p className="text-xs text-slate-500">Generate images with Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('featured')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'featured'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Featured Image
          </button>
          <button
            onClick={() => setActiveTab('inline')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'inline'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Inline Image
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gallery'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Gallery
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'featured' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Post Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={featuredTitle}
                  onChange={(e) => setFeaturedTitle(e.target.value)}
                  placeholder="Enter the blog post title"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={featuredDescription}
                  onChange={(e) => setFeaturedDescription(e.target.value)}
                  placeholder="Brief description of what the post is about"
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={featuredCategory}
                  onChange={(e) => setFeaturedCategory(e.target.value)}
                  placeholder="e.g., Technology, Business, Lifestyle"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                Featured images are generated at 1200x630 (social media optimized) with a professional digital art style.
              </p>
            </div>
          )}

          {activeTab === 'inline' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Context / Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={inlineContext}
                  onChange={(e) => setInlineContext(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Style
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {styleOptions.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setInlineStyle(style.value)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        inlineStyle === style.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {styleOptions.find(s => s.value === inlineStyle)?.description}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Inline images are generated at 1024x1024 (square format) for use within blog content.
              </p>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Context (optional)
                </label>
                <input
                  type="text"
                  value={uploadContext}
                  onChange={(e) => setUploadContext(e.target.value)}
                  placeholder="Describe the image for better AI analysis"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Helps AI generate better alt text and filename
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Upload area */}
              {!uploadedImage && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isUploading
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                      <p className="text-sm text-slate-600">Analyzing image with AI...</p>
                      <p className="text-xs text-slate-500 mt-1">Converting to WebP & generating alt text</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-10 h-10 text-slate-400 mb-3" />
                      <p className="text-sm text-slate-600">Click to upload an image</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF, WebP (max 10MB)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Uploaded image preview */}
              {uploadedImage && (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border border-slate-200">
                    <img
                      src={uploadedImage.url}
                      alt={uploadedImage.altText}
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Image info */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Alt text:</span>
                      <span className="text-slate-700 font-medium">{uploadedImage.altText}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Optimization:</span>
                      <span className="text-green-600 font-medium">
                        {formatSize(uploadedImage.originalSize)} → {formatSize(uploadedImage.optimizedSize)}
                        {' '}
                        ({Math.round((1 - uploadedImage.optimizedSize / uploadedImage.originalSize) * 100)}% smaller)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Format:</span>
                      <span className="text-slate-700">WebP</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleInsertUploadedImage}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Insert Image
                    </button>
                    <button
                      onClick={() => {
                        setUploadedImage(null)
                        fileInputRef.current?.click()
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Upload Different
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Images are automatically converted to WebP, renamed with SEO-friendly names, and assigned AI-generated alt text.
              </p>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div>
              {isLoadingGallery ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : galleryImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p>No AI-generated images yet</p>
                  <p className="text-sm">Generate some images to see them here</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {galleryImages.map((image) => (
                    <div
                      key={image.filename}
                      className="group relative rounded-lg overflow-hidden aspect-video cursor-pointer"
                      onClick={() => handleInsertGalleryImage(image)}
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                        {formatSize(image.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Generated Image Preview */}
          {generatedImage?.url && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Generated Image</h3>
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <img
                  src={generatedImage.url}
                  alt="Generated"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleInsert}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Insert Image
                </button>
                <button
                  onClick={() => {
                    setGeneratedImage(null)
                    activeTab === 'featured' ? handleGenerateFeatured() : handleGenerateInline()
                  }}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* Variants Preview */}
          {generatedVariants.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Choose a Style</h3>
              <div className="grid grid-cols-3 gap-4">
                {generatedVariants.map((variant, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedVariant(index)}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedVariant === index
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={`data:${variant.mimeType};base64,${variant.base64}`}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-auto"
                    />
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {['Photorealistic', 'Illustration', 'Digital Art'][index]}
                    </div>
                    {selectedVariant === index && (
                      <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                        <div className="p-2 bg-indigo-600 rounded-full">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedVariant !== null && (
                <button
                  onClick={() => handleSaveVariant(selectedVariant)}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Use This Image
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(activeTab === 'featured' || activeTab === 'inline') && !generatedImage && generatedVariants.length === 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Images are generated using Gemini AI and saved automatically
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateVariants}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Generate 3 Options
                  </>
                )}
              </button>
              <button
                onClick={activeTab === 'featured' ? handleGenerateFeatured : handleGenerateInline}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
