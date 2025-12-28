import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runScrub } from '../../../server/functions/ai/scrub'
import { getPosts } from '../../../server/functions/posts'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/seo/scrub')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: ScrubPage,
})

function ScrubPage() {
  const [posts, setPosts] = useState<{ slug: string; title: string; directory: 'published' | 'drafts' }[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runScrub>> | null>(null)
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
      const response = await runScrub({
        data: { slug, directory }
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrub failed')
    } finally {
      setLoading(false)
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

        <h1 className="text-3xl font-bold mb-2">Scrub AI Markers</h1>
        <p className="text-gray-400 mb-8">
          Remove invisible Unicode characters and formatting quirks that may indicate AI-generated content.
        </p>

        <div className="p-4 bg-gray-800 rounded-lg mb-8">
          <h3 className="font-medium mb-3">What gets cleaned:</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF, U+2060)
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Em-dashes (—) and en-dashes (–) → regular dashes
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Curly quotes ("" '') → straight quotes
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Non-breaking spaces → regular spaces
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Excessive empty lines (4+ → max 3)
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">✓</span>
              Trailing whitespace on lines
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Select Post to Scrub *</label>
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
            className="px-6 py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Scrubbing...' : 'Scrub Content'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg ${result.changes > 0 ? 'bg-green-900/50 border border-green-700' : 'bg-gray-800 border border-gray-700'}`}>
              <p className={result.changes > 0 ? 'text-green-400 text-lg font-medium' : 'text-gray-400 text-lg font-medium'}>
                {result.changes > 0 ? `Cleaned ${result.changes} issue${result.changes > 1 ? 's' : ''}!` : 'No AI markers detected'}
              </p>
            </div>

            {result.details.length > 0 && (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Changes Made</h3>
                <ul className="space-y-2">
                  {result.details.map((detail, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={result.changes > 0 ? 'text-green-400' : 'text-gray-500'}>
                        {result.changes > 0 ? '✓' : '•'}
                      </span>
                      <span className="text-gray-300">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <Link
                to="/seo/optimize"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                Run Optimization Check →
              </Link>
              <button
                onClick={() => {
                  setResult(null)
                  setSelectedPost('')
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Scrub Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
