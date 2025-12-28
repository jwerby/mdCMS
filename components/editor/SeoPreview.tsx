import { useState } from 'react'
import { Search, Twitter, Share2, AlertTriangle, CheckCircle, X } from 'lucide-react'

interface SeoPreviewProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  url: string
  image?: string
  siteName?: string
}

interface CharacterCountProps {
  current: number
  min: number
  max: number
  label: string
}

function CharacterCount({ current, min, max, label }: CharacterCountProps) {
  const isUnder = current < min
  const isOver = current > max
  const isOptimal = current >= min && current <= max

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">{label}:</span>
      <span className={`font-medium ${
        isOptimal ? 'text-emerald-600' : isOver ? 'text-red-600' : 'text-amber-600'
      }`}>
        {current}/{max}
      </span>
      {isOptimal && <CheckCircle className="w-3 h-3 text-emerald-500" />}
      {isUnder && <AlertTriangle className="w-3 h-3 text-amber-500" />}
      {isOver && <AlertTriangle className="w-3 h-3 text-red-500" />}
    </div>
  )
}

export function SeoPreview({ isOpen, onClose, title, description, url, image, siteName = 'Your Site' }: SeoPreviewProps) {
  const [activeTab, setActiveTab] = useState<'google' | 'twitter' | 'facebook'>('google')

  if (!isOpen) return null

  // Truncate text to simulate what search engines show
  const truncatedTitle = title.length > 60 ? title.slice(0, 57) + '...' : title
  const truncatedDescription = description.length > 160 ? description.slice(0, 157) + '...' : description

  // Format URL for display
  const displayUrl = url.startsWith('/') ? `https://yoursite.com${url}` : url

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Search className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">SEO Preview</h2>
              <p className="text-xs text-slate-500">See how your content appears in search results</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab('google')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'google'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            Google
          </button>
          <button
            onClick={() => setActiveTab('twitter')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'twitter'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Twitter className="w-4 h-4" />
            Twitter
          </button>
          <button
            onClick={() => setActiveTab('facebook')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'facebook'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Facebook
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Character counts */}
          <div className="flex gap-6 mb-6 p-3 bg-slate-50 rounded-lg">
            <CharacterCount current={title.length} min={50} max={60} label="Title" />
            <CharacterCount current={description.length} min={150} max={160} label="Description" />
          </div>

          {/* Google Preview */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Google Search Result</h3>
              <div className="p-4 border border-slate-200 rounded-lg bg-white">
                <div className="text-sm text-slate-500 mb-1">{displayUrl}</div>
                <h4 className="text-xl text-blue-700 hover:underline cursor-pointer font-normal mb-1">
                  {truncatedTitle || 'Page Title Here'}
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {truncatedDescription || 'Your meta description will appear here. Write a compelling description to improve click-through rates.'}
                </p>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Title should be 50-60 characters for optimal display</li>
                  <li>Description should be 150-160 characters</li>
                  <li>Include your primary keyword in the title</li>
                  <li>Make the description compelling and actionable</li>
                </ul>
              </div>
            </div>
          )}

          {/* Twitter Preview */}
          {activeTab === 'twitter' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Twitter Card Preview</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-w-md">
                {image ? (
                  <div className="h-40 bg-slate-100">
                    <img src={image} alt="Featured" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <span className="text-slate-400 text-sm">No featured image set</span>
                  </div>
                )}
                <div className="p-3">
                  <h4 className="font-bold text-slate-900 line-clamp-2 mb-1">
                    {title || 'Page Title Here'}
                  </h4>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {description || 'Your description will appear here.'}
                  </p>
                  <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    {siteName}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Add a featured image (1200x675 recommended)</li>
                  <li>Keep title under 70 characters</li>
                  <li>Description should be compelling and under 200 characters</li>
                </ul>
              </div>
            </div>
          )}

          {/* Facebook Preview */}
          {activeTab === 'facebook' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Facebook / Open Graph Preview</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-w-lg">
                {image ? (
                  <div className="h-52 bg-slate-100">
                    <img src={image} alt="Featured" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-52 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <span className="text-slate-400 text-sm">No featured image set (1200x630 recommended)</span>
                  </div>
                )}
                <div className="p-3 bg-slate-50">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    {siteName}
                  </div>
                  <h4 className="font-semibold text-slate-900 line-clamp-2 mb-1">
                    {title || 'Page Title Here'}
                  </h4>
                  <p className="text-sm text-slate-500 line-clamp-1">
                    {description || 'Your description will appear here.'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Image should be at least 1200x630 pixels</li>
                  <li>Title displays up to 2 lines</li>
                  <li>Description displays only 1 line</li>
                  <li>Test with Facebook Sharing Debugger</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.15s ease-out;
        }
      `}</style>
    </div>
  )
}
