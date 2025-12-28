import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runWrite } from '../../../server/functions/ai/write'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'
import { useSEOResearchStore } from '../../../lib/store'

export const Route = createFileRoute('/seo/write')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: WritePage,
})

function WritePage() {
  const [topic, setTopic] = useState('')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [secondaryKeywords, setSecondaryKeywords] = useState('')
  const [outline, setOutline] = useState('')
  const [targetWordCount, setTargetWordCount] = useState('2500')
  const [researchBrief, setResearchBrief] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runWrite>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)

  const researchData = useSEOResearchStore((s) => s.researchData)
  const clearResearchData = useSEOResearchStore((s) => s.clearResearchData)

  // Auto-populate from research data
  useEffect(() => {
    if (researchData && !prefilled) {
      setTopic(researchData.topic)
      setPrimaryKeyword(researchData.primaryKeyword)
      setSecondaryKeywords(researchData.secondaryKeywords.join(', '))
      setOutline(researchData.outline.join('\n'))
      setTargetWordCount(String(researchData.targetWordCount))
      setResearchBrief(researchData.rawContent)
      setPrefilled(true)
    }
  }, [researchData, prefilled])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || !primaryKeyword.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await runWrite({
        data: {
          topic: topic.trim(),
          primaryKeyword: primaryKeyword.trim(),
          secondaryKeywords: secondaryKeywords.trim() ? secondaryKeywords.split(',').map(k => k.trim()) : undefined,
          outline: outline.trim() ? outline.split('\n').filter(l => l.trim()) : undefined,
          targetWordCount: parseInt(targetWordCount) || 2500,
          researchBrief: researchBrief.trim() || undefined,
        }
      })
      setResult(response)
      // Clear research data after successful write
      clearResearchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Write failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClearPrefill = () => {
    setTopic('')
    setPrimaryKeyword('')
    setSecondaryKeywords('')
    setOutline('')
    setTargetWordCount('2500')
    setResearchBrief('')
    clearResearchData()
    setPrefilled(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/seo" className="text-gray-400 hover:text-white">
            ← Back to SEO Commands
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Write Article</h1>
        <p className="text-gray-400 mb-8">
          Generate comprehensive, SEO-optimized long-form content. Articles are saved as drafts for review.
        </p>

        {prefilled && (
          <div className="p-4 bg-blue-900/50 border border-blue-700 rounded-lg mb-6 flex items-center justify-between">
            <p className="text-blue-400">
              Form pre-filled from your research brief. Review and customize as needed.
            </p>
            <button
              type="button"
              onClick={handleClearPrefill}
              className="text-blue-300 hover:text-white text-sm underline"
            >
              Clear & Start Fresh
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Topic *</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Virtual Phone Systems for Small Business"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Primary Keyword *</label>
              <input
                type="text"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="e.g., virtual phone system"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Secondary Keywords (optional)</label>
            <input
              type="text"
              value={secondaryKeywords}
              onChange={(e) => setSecondaryKeywords(e.target.value)}
              placeholder="e.g., business phone, VoIP, cloud phone system"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Content Outline (optional)</label>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="Enter each heading on a new line:&#10;What is a Virtual Phone System?&#10;Benefits for Small Business&#10;Top Features to Look For&#10;How to Choose the Right Provider"
              rows={5}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">One heading per line</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Word Count</label>
            <select
              value={targetWordCount}
              onChange={(e) => setTargetWordCount(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="1500">1,500+ words (short)</option>
              <option value="2500">2,500+ words (standard)</option>
              <option value="3500">3,500+ words (long-form)</option>
              <option value="5000">5,000+ words (pillar content)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Research Brief (optional)</label>
            <textarea
              value={researchBrief}
              onChange={(e) => setResearchBrief(e.target.value)}
              placeholder="Paste research notes, competitor analysis, or additional context here..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim() || !primaryKeyword.trim()}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Writing Article...' : 'Generate Article'}
          </button>

          {loading && (
            <p className="text-gray-400 text-sm">
              This may take 30-60 seconds for a comprehensive article...
            </p>
          )}
        </form>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg">
              <p className="text-green-400 text-lg font-medium">Article Created!</p>
              <p className="text-gray-300 mt-2">{result.title}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-400">{result.wordCount.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">Words</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">{result.provider}</p>
                <p className="text-gray-400 text-sm">AI Provider</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-400">Draft</p>
                <p className="text-gray-400 text-sm">Status</p>
              </div>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg">
              <h3 className="font-medium mb-2">Saved To</h3>
              <code className="text-blue-400">content/drafts/{result.filename}</code>
            </div>

            <div className="flex gap-4">
              <Link
                to="/dashboard/editor/$slug"
                params={{ slug: result.id ?? result.slug }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Open in Editor →
              </Link>
              <Link
                to="/seo/optimize"
                search={{ slug: result.slug, directory: 'drafts' }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Run Optimization Check
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
