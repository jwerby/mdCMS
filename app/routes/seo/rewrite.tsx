import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runRewrite } from '../../../server/functions/ai/rewrite'
import { getPosts } from '../../../server/functions/posts'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/seo/rewrite')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: RewritePage,
})

function RewritePage() {
  const [posts, setPosts] = useState<{ slug: string; title: string; directory: 'published' | 'drafts' }[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runRewrite>> | null>(null)
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
      const response = await runRewrite({
        data: {
          slug,
          directory,
          targetKeyword: targetKeyword.trim() || undefined,
          instructions: instructions.trim() || undefined,
        }
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rewrite failed')
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

        <h1 className="text-3xl font-bold mb-2">Rewrite Content</h1>
        <p className="text-gray-400 mb-8">
          Improve existing content for better SEO performance while maintaining your brand voice.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Select Post to Rewrite *</label>
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
            <label className="block text-sm font-medium mb-2">Target Keyword (optional)</label>
            <input
              type="text"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g., virtual phone system for small business"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Override the existing primary keyword</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Special Instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Focus on mobile features, add more statistics, update pricing information..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ This will overwrite the existing file. The original content will not be backed up.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedPost}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Rewriting...' : 'Rewrite Content'}
          </button>

          {loading && (
            <p className="text-gray-400 text-sm">
              This may take 30-60 seconds...
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
              <p className="text-green-400 text-lg font-medium">Content Rewritten!</p>
              <p className="text-gray-300 mt-2">{result.filename}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-400">{result.originalWordCount.toLocaleString()}</p>
                <p className="text-gray-500 text-sm">Original Words</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-400">{result.newWordCount.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">New Words</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className={`text-2xl font-bold ${result.newWordCount > result.originalWordCount ? 'text-green-400' : 'text-orange-400'}`}>
                  {result.newWordCount > result.originalWordCount ? '+' : ''}{result.newWordCount - result.originalWordCount}
                </p>
                <p className="text-gray-400 text-sm">Difference</p>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                to="/dashboard/editor/$slug"
                params={{ slug: result.id ?? result.filename.replace('.md', '') }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Open in Editor →
              </Link>
              <Link
                to="/seo/optimize"
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
