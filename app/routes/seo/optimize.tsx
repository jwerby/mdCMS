import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runOptimize } from '../../../server/functions/ai/optimize'
import { getPosts } from '../../../server/functions/posts'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'

type SearchParams = {
  slug?: string
  directory?: 'published' | 'drafts'
}

export const Route = createFileRoute('/seo/optimize')({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      slug: typeof search.slug === 'string' ? search.slug : undefined,
      directory: search.directory === 'published' || search.directory === 'drafts' ? search.directory : undefined,
    }
  },
  beforeLoad: async () => {
    await requireAuth()
  },
  component: OptimizePage,
})

function ScoreBar({ score, max, label }: { score: number; max: number; label: string }) {
  const percentage = (score / max) * 100
  const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{score}/{max}</span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function OptimizePage() {
  const { slug: urlSlug, directory: urlDirectory } = Route.useSearch()
  const [posts, setPosts] = useState<{ slug: string; title: string; directory: 'published' | 'drafts' }[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runOptimize>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRun, setAutoRun] = useState(false)

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await getPosts()
        const allPosts = [
          ...data.published.map(p => ({ ...p, directory: 'published' as const })),
          ...data.drafts.map(p => ({ ...p, directory: 'drafts' as const })),
        ]
        setPosts(allPosts)

        // Pre-select from URL params if provided
        if (urlSlug && urlDirectory) {
          const preselect = `${urlDirectory}:${urlSlug}`
          const exists = allPosts.some(p => `${p.directory}:${p.slug}` === preselect)
          if (exists) {
            setSelectedPost(preselect)
            setAutoRun(true)
          }
        }
      } catch (err) {
        console.error('Failed to load posts:', err)
      } finally {
        setLoadingPosts(false)
      }
    }
    loadPosts()
  }, [urlSlug, urlDirectory])

  // Auto-run analysis when pre-selected from URL
  useEffect(() => {
    if (autoRun && selectedPost && !loading && !result) {
      setAutoRun(false)
      handleAnalyze()
    }
  }, [autoRun, selectedPost])

  const handleAnalyze = async () => {
    if (!selectedPost) return

    const [directory, slug] = selectedPost.split(':') as ['published' | 'drafts', string]

    setLoading(true)
    setError(null)

    try {
      const response = await runOptimize({
        data: { slug, directory }
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    handleAnalyze()
  }

  const getOverallColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/seo" className="text-gray-400 hover:text-white">
            ← Back to SEO Commands
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">SEO Optimization Check</h1>
        <p className="text-gray-400 mb-8">
          Score your content on readability, SEO, engagement, and originality. Get actionable recommendations.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Select Post to Analyze *</label>
            {loadingPosts ? (
              <div className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg">
                Loading posts...
              </div>
            ) : (
              <select
                value={selectedPost}
                onChange={(e) => setSelectedPost(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">Choose a post...</option>
                <optgroup label="Published">
                  {posts.filter(p => p.directory === 'published').map(post => (
                    <option key={`published:${post.slug}`} value={`published:${post.slug}`}>
                      {post.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Drafts">
                  {posts.filter(p => p.directory === 'drafts').map(post => (
                    <option key={`drafts:${post.slug}`} value={`drafts:${post.slug}`}>
                      {post.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !selectedPost}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="p-6 bg-gray-800 rounded-lg text-center">
              <p className={`text-6xl font-bold ${getOverallColor(result.overall)}`}>
                {result.overall}
              </p>
              <p className="text-gray-400 mt-2">Overall Score</p>
              <p className="text-gray-500 text-sm mt-1">Provider: {result.provider}</p>
            </div>

            {/* Score Breakdown */}
            <div className="p-6 bg-gray-800 rounded-lg space-y-4">
              <h3 className="font-medium text-lg mb-4">Score Breakdown</h3>
              <ScoreBar score={result.scores.readability} max={25} label="Readability" />
              <ScoreBar score={result.scores.seo} max={25} label="SEO" />
              <ScoreBar score={result.scores.engagement} max={25} label="Engagement" />
              <ScoreBar score={result.scores.originality} max={25} label="Originality" />
            </div>

            {/* Priority Fixes */}
            {result.recommendations.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Top Priority Fixes</h3>
                <ol className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {i + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Issues Found */}
            {result.issues.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Issues Found ({result.issues.length})</h3>
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-red-400">•</span>
                      <span className="text-gray-300">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Full Analysis */}
            <details className="p-6 bg-gray-800 rounded-lg">
              <summary className="cursor-pointer font-medium">View Full Analysis</summary>
              <div className="mt-4 prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                {result.rawAnalysis}
              </div>
            </details>

            <div className="flex gap-4">
              <Link
                to="/seo/rewrite"
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-medium transition-colors"
              >
                Rewrite to Improve →
              </Link>
              <Link
                to="/seo/scrub"
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Scrub AI Markers
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
