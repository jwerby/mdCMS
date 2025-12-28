import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runAnalyze } from '../../../server/functions/ai/analyze'
import { getPosts } from '../../../server/functions/posts'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/seo/analyze')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: AnalyzePage,
})

function AnalyzePage() {
  const [posts, setPosts] = useState<{ slug: string; title: string; directory: 'published' | 'drafts' }[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runAnalyze>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await getPosts()
        const allPosts = [
          ...data.published.map(p => ({ ...p, directory: 'published' as const })),
          ...data.drafts.map(p => ({ ...p, directory: 'drafts' as const })),
        ]
        setPosts(allPosts)
      } catch (err) {
        console.error('Failed to load posts:', err)
      } finally {
        setLoadingPosts(false)
      }
    }
    loadPosts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPost) return

    const [directory, slug] = selectedPost.split(':') as ['published' | 'drafts', string]

    setLoading(true)
    setError(null)

    try {
      const response = await runAnalyze({
        data: {
          slug,
          directory,
          competitors: competitors.trim() ? competitors.split(',').map(c => c.trim()) : undefined,
        }
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/seo" className="text-gray-400 hover:text-white">
            ← Back to SEO Commands
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Content Gap Analysis</h1>
        <p className="text-gray-400 mb-8">
          Identify missing topics, update opportunities, and new article ideas based on competitor analysis.
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

          <div>
            <label className="block text-sm font-medium mb-2">Competitors (optional)</label>
            <input
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="e.g., grasshopper.com, dialpad.com, ringcentral.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list of competitor domains to compare against</p>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedPost}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Run Gap Analysis'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg">
              <p className="text-green-400">Analysis complete! Provider: {result.provider}</p>
            </div>

            {/* Content Gaps */}
            {result.contentGaps.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Content Gaps ({result.contentGaps.length})</h3>
                <div className="space-y-4">
                  {result.contentGaps.map((gap, i) => (
                    <div key={i} className="p-4 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 ${getPriorityColor(gap.priority)} rounded text-xs font-medium uppercase`}>
                          {gap.priority}
                        </span>
                        <span className="font-medium">{gap.topic}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{gap.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Update Opportunities */}
            {result.updateOpportunities.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Update Opportunities ({result.updateOpportunities.length})</h3>
                <div className="space-y-4">
                  {result.updateOpportunities.map((opp, i) => (
                    <div key={i} className="p-4 bg-gray-700/50 rounded-lg">
                      <p className="font-medium text-yellow-400 mb-1">{opp.section}</p>
                      <p className="text-gray-400 text-sm mb-2">Issue: {opp.issue}</p>
                      <p className="text-green-400 text-sm">Suggestion: {opp.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Linking */}
            {result.internalLinkSuggestions.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Internal Linking Opportunities</h3>
                <ul className="space-y-2">
                  {result.internalLinkSuggestions.map((link, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-blue-400">→</span>
                      <span className="text-gray-300">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* New Article Ideas */}
            {result.newArticleIdeas.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">New Article Ideas</h3>
                <ul className="space-y-2">
                  {result.newArticleIdeas.map((idea, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-purple-400">+</span>
                      <span className="text-gray-300">{idea}</span>
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
                Rewrite with Improvements →
              </Link>
              <Link
                to="/seo/research"
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Research New Topics
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
