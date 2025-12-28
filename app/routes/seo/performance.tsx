import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { runPerformance } from '../../../server/functions/ai/performance'
import { getPublishedPosts, type Post } from '../../../server/functions/posts'
import { requireAuth } from '../../../lib/auth-utils'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/seo/performance')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const posts = await getPublishedPosts()
    return { posts }
  },
  component: PerformancePage,
})

function PerformancePage() {
  const { posts } = Route.useLoaderData() as { posts: Post[] }
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runPerformance>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const slugToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const post of posts ?? []) {
      if (!post.id) continue
      map.set(post.slug, post.id)
      const filenameSlug = post.filename
        .replace(/\.md$/, '')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '')
      map.set(filenameSlug, post.id)
    }
    return map
  }, [posts])

  const resolveEditorParam = (taskSlug: string, articleId?: string): string => {
    if (articleId) return articleId
    const normalized = taskSlug.replace(/^\/blog\//, '').replace(/^\//, '')
    return slugToId.get(normalized) ?? normalized
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError(null)

    try {
      const response = await runPerformance({
        data: {
          // Analytics data would be passed here if available
          // For now, running content-only analysis
        }
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Performance analysis failed')
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

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'rewrite': return '✏️'
      case 'update': return '🔄'
      case 'optimize': return '⚡'
      case 'expand': return '📈'
      case 'consolidate': return '🔗'
      default: return '📝'
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

        <h1 className="text-3xl font-bold mb-2">Performance Review</h1>
        <p className="text-gray-400 mb-8">
          Analyze your content portfolio and get a prioritized task queue based on performance data.
        </p>

        <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg mb-8">
          <p className="text-yellow-400 text-sm">
            <span className="font-medium">Note:</span> For best results, connect GA4 and Search Console data sources.
            Currently running content-only analysis based on publication dates, word counts, and keyword targeting.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Analyzing Portfolio...' : 'Run Performance Review'}
          </button>

          {loading && (
            <p className="text-gray-400 text-sm">
              Analyzing all published content. This may take a moment...
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
              <p className="text-green-400">
                Analysis complete! Data source: {result.dataSource === 'analytics' ? 'Analytics Data' : 'Content Only'}
              </p>
              <p className="text-gray-400 text-sm mt-1">Provider: {result.provider}</p>
            </div>

            {/* Summary */}
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="font-medium text-lg mb-3">Portfolio Summary</h3>
              <p className="text-gray-300">{result.summary}</p>
            </div>

            {/* Task Queue */}
            {result.tasks.length > 0 ? (
              <div className="p-6 bg-gray-800 rounded-lg">
                <h3 className="font-medium text-lg mb-4">Content Task Queue ({result.tasks.length})</h3>
                <div className="space-y-4">
                  {result.tasks.map((task, i) => (
                    <div key={i} className="p-4 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">{getTaskTypeIcon(task.taskType)}</span>
                        <span className={`px-2 py-0.5 ${getPriorityColor(task.priority)} rounded text-xs font-medium uppercase`}>
                          {task.priority}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-600 rounded text-xs font-medium uppercase">
                          {task.taskType}
                        </span>
                      </div>
                      <p className="font-medium mb-1">{task.title}</p>
                      <p className="text-gray-400 text-sm mb-2">{task.reason}</p>
                      <p className="text-green-400 text-sm">Expected: {task.expectedImpact}</p>
                      <div className="mt-3 flex gap-2">
                        {task.taskType === 'rewrite' && (
                          <Link
                            to="/seo/rewrite"
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm transition-colors"
                          >
                            Rewrite →
                          </Link>
                        )}
                        {task.taskType === 'optimize' && (
                          <Link
                            to="/seo/optimize"
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                          >
                            Optimize →
                          </Link>
                        )}
                        {(task.taskType === 'update' || task.taskType === 'expand') && (
                          <Link
                            to="/dashboard/editor/$slug"
                            params={{ slug: resolveEditorParam(task.slug, task.articleId) }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                          >
                            Edit →
                          </Link>
                        )}
                        {task.taskType === 'consolidate' && (
                          <Link
                            to="/seo/analyze"
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
                          >
                            Analyze →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gray-800 rounded-lg text-center">
                <p className="text-gray-400">No content tasks identified. Your content portfolio looks healthy!</p>
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
                to="/seo/research"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Research New Topics →
              </Link>
              <Link
                to="/seo/write"
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                Write New Content
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
