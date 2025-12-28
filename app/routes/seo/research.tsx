import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { runResearch } from '../../../server/functions/ai/research'
import { runWrite } from '../../../server/functions/ai/write'
import { requireAuth } from '../../../lib/auth-utils'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSEOResearchStore } from '../../../lib/store'

export const Route = createFileRoute('/seo/research')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: ResearchPage,
})

function parseOutlineFromContent(content: string): string[] {
  const lines = content.split('\n')
  const outline: string[] = []
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      outline.push(match[1].trim())
    }
  }
  return outline
}

function ResearchPage() {
  const [topic, setTopic] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof runResearch>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const setResearchData = useSEOResearchStore((s) => s.setResearchData)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await runResearch({
        data: {
          topic: topic.trim(),
          targetAudience: targetAudience.trim() || undefined,
          competitors: competitors.trim() ? competitors.split(',').map(c => c.trim()) : undefined,
        }
      })
      setResult(response)

      // Parse outline from the raw content
      const outline = parseOutlineFromContent(response.rawContent)

      // Store in Zustand for the Write page
      setResearchData({
        topic: response.topic,
        primaryKeyword: response.primaryKeyword,
        secondaryKeywords: response.secondaryKeywords,
        targetWordCount: response.targetWordCount,
        rawContent: response.rawContent,
        outline,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateNow = async () => {
    if (!result) return

    setGenerating(true)
    setError(null)

    try {
      const outline = parseOutlineFromContent(result.rawContent)

      const writeResult = await runWrite({
        data: {
          topic: result.topic,
          primaryKeyword: result.primaryKeyword,
          secondaryKeywords: result.secondaryKeywords.length > 0 ? result.secondaryKeywords : undefined,
          outline: outline.length > 0 ? outline : undefined,
          targetWordCount: result.targetWordCount,
          researchBrief: result.rawContent,
        }
      })

      // Navigate to the editor with the new draft
      navigate({
        to: '/dashboard/editor/$slug',
        params: { slug: writeResult.id ?? writeResult.slug }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Article generation failed')
    } finally {
      setGenerating(false)
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

        <h1 className="text-3xl font-bold mb-2">Keyword Research</h1>
        <p className="text-gray-400 mb-8">
          Generate comprehensive SEO research briefs with keyword suggestions, competitor analysis, and content outlines.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How to choose a virtual phone system for small business"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Audience (optional)</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Small business owners, entrepreneurs, startups"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Competitors to Analyze (optional)</label>
            <input
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="e.g., grasshopper.com, dialpad.com, ringcentral.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list of competitor domains</p>
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? 'Researching...' : 'Run Research'}
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
              <p className="text-green-400">
                Research complete! Saved to: <code className="bg-gray-800 px-2 py-1 rounded">{result.savedTo}</code>
              </p>
              <p className="text-gray-400 text-sm mt-1">Provider: {result.provider}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-medium mb-2">Primary Keyword</h3>
                <p className="text-blue-400">{result.primaryKeyword}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-medium mb-2">Target Word Count</h3>
                <p className="text-blue-400">{result.targetWordCount}+ words</p>
              </div>
            </div>

            {result.secondaryKeywords.length > 0 && (
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-medium mb-2">Secondary Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {result.secondaryKeywords.map((kw, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-700 rounded-full text-sm">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-800 rounded-lg">
              <h3 className="font-medium mb-4">Full Research Brief</h3>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                {result.rawContent}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleGenerateNow}
                disabled={generating}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {generating ? 'Generating Article...' : 'Generate Article Now'}
              </button>
              <Link
                to="/seo/write"
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                Customize & Write →
              </Link>
            </div>

            {generating && (
              <p className="text-gray-400 text-sm">
                Generating article... This may take 30-60 seconds.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
