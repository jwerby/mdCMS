import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, FileText, RefreshCw, Sparkles, BarChart3, Eraser, TrendingUp, X } from 'lucide-react'

const commands = [
  { name: 'Research', path: '/seo/research', icon: Search, description: 'Keyword research and content briefs' },
  { name: 'Write', path: '/seo/write', icon: FileText, description: 'Generate SEO-optimized articles' },
  { name: 'Rewrite', path: '/seo/rewrite', icon: RefreshCw, description: 'Improve existing content' },
  { name: 'Optimize', path: '/seo/optimize', icon: Sparkles, description: 'SEO scoring and fixes' },
  { name: 'Analyze', path: '/seo/analyze', icon: BarChart3, description: 'Content gap analysis' },
  { name: 'Scrub', path: '/seo/scrub', icon: Eraser, description: 'Remove AI markers' },
  { name: 'Performance', path: '/seo/performance', icon: TrendingUp, description: 'Portfolio review' },
]

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd+K or Ctrl+K to open
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setIsOpen(prev => !prev)
      setSearch('')
      setSelectedIndex(0)
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      navigate({ to: filteredCommands[selectedIndex].path as any })
      setIsOpen(false)
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search SEO commands..."
            className="flex-1 text-lg outline-none placeholder:text-gray-400"
            autoFocus
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon
              return (
                <button
                  key={cmd.path}
                  onClick={() => {
                    navigate({ to: cmd.path as any })
                    setIsOpen(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    index === selectedIndex ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${index === selectedIndex ? 'text-indigo-600' : 'text-gray-900'}`}>
                      /{cmd.name.toLowerCase()}
                    </p>
                    <p className="text-sm text-gray-500">{cmd.description}</p>
                  </div>
                  {index === selectedIndex && (
                    <kbd className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded text-xs font-mono">
                      Enter
                    </kbd>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border rounded">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded">Enter</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border rounded">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}
