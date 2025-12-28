import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  AlertTriangle,
  FileText,
  PenTool,
  List,
  Zap,
  Search,
  Check
} from 'lucide-react'
import {
  generateKeywordIdeas,
  generateContentCluster,
  analyzeContentGaps,
  getExistingContentSummary,
  type KeywordIdea,
  type ContentGapAnalysis
} from '../../../../server/functions/seo-planner/ideation'
import { createArticle } from '../../../../server/functions/seo-planner/article-queue'
import { requireAuth } from '../../../../lib/auth-utils'
import { useToastStore } from '../../../../lib/store'

export const Route = createFileRoute('/dashboard/seo-planner/ideate')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const contentSummary = await getExistingContentSummary()
    return { contentSummary }
  },
  component: IdeationPage
})

type ResultsTab = 'gaps' | 'ideas' | 'cluster'

function IdeationPage() {
  const { contentSummary } = Route.useLoaderData()
  const { addToast } = useToastStore()
  const hasExistingContent = contentSummary.published > 0 || contentSummary.drafts > 0 || contentSummary.queued > 0

  // Context state (shared across all features)
  const [niche, setNiche] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')

  // Results state
  const [activeTab, setActiveTab] = useState<ResultsTab | null>(null)
  const [ideas, setIdeas] = useState<KeywordIdea[]>([])
  const [ideaSummary, setIdeaSummary] = useState('')
  const [gapAnalysis, setGapAnalysis] = useState<ContentGapAnalysis | null>(null)
  const [clusterResult, setClusterResult] = useState<any>(null)
  const [pillarTopic, setPillarTopic] = useState('')

  // Loading states
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false)
  const [isLoadingGaps, setIsLoadingGaps] = useState(false)
  const [isLoadingCluster, setIsLoadingCluster] = useState(false)

  // UI state
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null)
  const [addingToQueue, setAddingToQueue] = useState<Set<string>>(new Set())
  const [addedToQueue, setAddedToQueue] = useState<Set<string>>(new Set())

  const handleGenerateIdeas = async () => {
    if (!niche.trim()) {
      addToast('Please enter your niche first', 'error')
      return
    }

    setIsLoadingIdeas(true)
    setActiveTab('ideas')

    try {
      const result = await generateKeywordIdeas({
        data: {
          niche: niche.trim(),
          businessDescription: businessDescription.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          existingTopics: contentSummary.sampleTopics,
          count: 15
        }
      })

      setIdeas(result.ideas)
      setIdeaSummary(result.summary)
      addToast(`Generated ${result.ideas.length} keyword ideas`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to generate ideas', 'error')
    } finally {
      setIsLoadingIdeas(false)
    }
  }

  const handleAnalyzeGaps = async () => {
    if (!niche.trim()) {
      addToast('Please enter your niche first', 'error')
      return
    }

    setIsLoadingGaps(true)
    setActiveTab('gaps')

    try {
      const result = await analyzeContentGaps({
        data: {
          niche: niche.trim(),
          businessDescription: businessDescription.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          count: 10
        }
      })
      setGapAnalysis(result)
      addToast(`Found ${result.gaps.length} content gaps`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to analyze gaps', 'error')
    } finally {
      setIsLoadingGaps(false)
    }
  }

  const handleGenerateCluster = async (topic?: string) => {
    const topicToUse = topic || pillarTopic
    if (!topicToUse.trim()) {
      addToast('Please enter a pillar topic', 'error')
      return
    }

    setIsLoadingCluster(true)
    setActiveTab('cluster')
    setPillarTopic(topicToUse)

    try {
      const result = await generateContentCluster({
        data: {
          pillarTopic: topicToUse.trim(),
          niche: niche.trim() || undefined,
          depth: 'medium'
        }
      })
      setClusterResult(result)
      addToast('Content cluster generated!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to generate cluster', 'error')
    } finally {
      setIsLoadingCluster(false)
    }
  }

  const handleAddToQueue = async (idea: KeywordIdea) => {
    if (addedToQueue.has(idea.keyword)) return

    setAddingToQueue(prev => new Set(prev).add(idea.keyword))

    try {
      await createArticle({
        data: {
          title: idea.articleTitle,
          targetKeywords: [idea.keyword, ...idea.relatedKeywords.slice(0, 3)],
          notes: `${idea.rationale}\n\nContent Type: ${idea.contentType}\nSearch Intent: ${idea.searchIntent}\nEstimated Volume: ${idea.estimatedVolume}\nDifficulty: ${idea.estimatedDifficulty}`,
          estimatedTraffic: idea.trafficPotential * 10,
          category: idea.contentType
        }
      })
      setAddedToQueue(prev => new Set(prev).add(idea.keyword))
      addToast(`Added "${idea.keyword}" to queue`, 'success')
    } catch (err) {
      addToast('Failed to add to queue', 'error')
    } finally {
      setAddingToQueue(prev => {
        const next = new Set(prev)
        next.delete(idea.keyword)
        return next
      })
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700'
      case 'medium': return 'bg-amber-100 text-amber-700'
      case 'hard': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getVolumeColor = (volume: string) => {
    switch (volume) {
      case 'high': return 'bg-indigo-100 text-indigo-700'
      case 'medium': return 'bg-blue-100 text-blue-700'
      case 'low': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-300 bg-red-50'
      case 'medium': return 'border-amber-300 bg-amber-50'
      case 'low': return 'border-slate-300 bg-slate-50'
      default: return 'border-slate-300 bg-slate-50'
    }
  }

  const isLoading = isLoadingIdeas || isLoadingGaps || isLoadingCluster

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/seo-planner" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Content Ideation
              </h1>
              <p className="text-sm text-slate-500">
                Discover keyword opportunities and plan your content strategy
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Step 1: Context Setup */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">1</div>
            <h2 className="text-lg font-semibold text-slate-800">Define Your Context</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Niche / Industry <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  placeholder="e.g., volleyball training, sustainable fashion, SaaS marketing"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g., coaches, beginners, small business owners"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Description
              </label>
              <input
                type="text"
                value={businessDescription}
                onChange={e => setBusinessDescription(e.target.value)}
                placeholder="What makes you unique?"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Content Summary inline */}
          {hasExistingContent && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-slate-500">Your content:</span>
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-green-600" />
                  <strong>{contentSummary.published}</strong> published
                </span>
                <span className="flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-amber-600" />
                  <strong>{contentSummary.drafts}</strong> drafts
                </span>
                <span className="flex items-center gap-1.5">
                  <List className="w-4 h-4 text-indigo-600" />
                  <strong>{contentSummary.queued}</strong> queued
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Choose Action */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">2</div>
            <h2 className="text-lg font-semibold text-slate-800">Generate Ideas</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fresh Ideas */}
            <button
              onClick={handleGenerateIdeas}
              disabled={isLoading || !niche.trim()}
              className="group p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 transition-colors">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="font-semibold text-slate-800">Fresh Ideas</span>
              </div>
              <p className="text-sm text-slate-500">
                Generate new keyword opportunities based on your niche
              </p>
              {isLoadingIdeas && (
                <div className="mt-3 flex items-center gap-2 text-indigo-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </div>
              )}
            </button>

            {/* Content Gaps */}
            <button
              onClick={handleAnalyzeGaps}
              disabled={isLoading || !niche.trim() || !hasExistingContent}
              className="group p-4 border-2 border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
                  <FileSearch className="w-5 h-5 text-amber-600" />
                </div>
                <span className="font-semibold text-slate-800">Find Gaps</span>
              </div>
              <p className="text-sm text-slate-500">
                {hasExistingContent
                  ? 'Analyze existing content to find missing topics'
                  : 'Publish content first to use this feature'}
              </p>
              {isLoadingGaps && (
                <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </div>
              )}
            </button>

            {/* Content Cluster */}
            <div className="p-4 border-2 border-slate-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-semibold text-slate-800">Build Cluster</span>
              </div>
              <input
                type="text"
                value={pillarTopic}
                onChange={e => setPillarTopic(e.target.value)}
                placeholder="Enter pillar topic..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
              />
              <button
                onClick={() => handleGenerateCluster()}
                disabled={isLoading || !pillarTopic.trim()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isLoadingCluster ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Generate Cluster
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Step 3: Results */}
        {activeTab && (
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-slate-200 flex">
              {ideas.length > 0 && (
                <button
                  onClick={() => setActiveTab('ideas')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'ideas'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Ideas ({ideas.length})
                </button>
              )}
              {gapAnalysis && (
                <button
                  onClick={() => setActiveTab('gaps')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'gaps'
                      ? 'border-amber-600 text-amber-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Gaps ({gapAnalysis.gaps.length})
                </button>
              )}
              {clusterResult && (
                <button
                  onClick={() => setActiveTab('cluster')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'cluster'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Target className="w-4 h-4 inline mr-2" />
                  Cluster
                </button>
              )}
            </div>

            <div className="p-6">
              {/* Ideas Tab */}
              {activeTab === 'ideas' && ideas.length > 0 && (
                <div className="space-y-4">
                  {ideaSummary && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800">
                      {ideaSummary}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                    <span>{ideas.length} keyword opportunities</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Easy</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Hard</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {ideas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-colors"
                      >
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedIdea(expandedIdea === idx ? null : idx)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(idea.estimatedDifficulty)}`}>
                                  {idea.estimatedDifficulty}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVolumeColor(idea.estimatedVolume)}`}>
                                  {idea.estimatedVolume} vol
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                  {idea.contentType}
                                </span>
                              </div>
                              <h3 className="font-medium text-slate-800">{idea.keyword}</h3>
                              <p className="text-sm text-slate-500 truncate">{idea.articleTitle}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-emerald-600">
                                  <TrendingUp className="w-4 h-4" />
                                  <span className="font-bold">{idea.trafficPotential}</span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddToQueue(idea)
                                }}
                                disabled={addingToQueue.has(idea.keyword) || addedToQueue.has(idea.keyword)}
                                className={`p-2 rounded-lg transition-colors ${
                                  addedToQueue.has(idea.keyword)
                                    ? 'bg-green-100 text-green-600'
                                    : 'text-indigo-600 hover:bg-indigo-50'
                                } disabled:cursor-not-allowed`}
                                title={addedToQueue.has(idea.keyword) ? 'Added to queue' : 'Add to queue'}
                              >
                                {addingToQueue.has(idea.keyword) ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : addedToQueue.has(idea.keyword) ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <Plus className="w-5 h-5" />
                                )}
                              </button>

                              {expandedIdea === idx ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {expandedIdea === idx && (
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
                            <div className="pt-3 space-y-3">
                              <p className="text-sm text-slate-600">{idea.rationale}</p>

                              <div className="flex flex-wrap gap-1.5">
                                {idea.relatedKeywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                                    {kw}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center gap-4 pt-2">
                                <a
                                  href={`https://www.google.com/search?q=${encodeURIComponent(idea.keyword)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  Search Google <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateCluster(idea.keyword)
                                  }}
                                  className="text-sm text-purple-600 hover:underline flex items-center gap-1"
                                >
                                  Build cluster around this <Target className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps Tab */}
              {activeTab === 'gaps' && gapAnalysis && (
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">{gapAnalysis.summary}</p>
                    <div className="mt-2 text-xs text-amber-600">
                      Analyzed {gapAnalysis.existingContent.published} published, {gapAnalysis.existingContent.drafts} drafts, {gapAnalysis.existingContent.queued} queued
                    </div>
                  </div>

                  {/* Gaps List */}
                  <div>
                    <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Content Gaps
                    </h3>
                    <div className="space-y-2">
                      {gapAnalysis.gaps.map((gap, idx) => (
                        <div
                          key={idx}
                          className={`border rounded-lg p-3 ${getPriorityColor(gap.priority)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                                gap.priority === 'high' ? 'bg-red-200 text-red-800' :
                                gap.priority === 'medium' ? 'bg-amber-200 text-amber-800' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {gap.priority}
                              </span>
                              <p className="font-medium text-slate-800">{gap.topic}</p>
                              <p className="text-sm text-slate-600 mt-1">{gap.reason}</p>
                              {gap.suggestedKeywords.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {gap.suggestedKeywords.map((kw, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-slate-600 border border-slate-200">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gap Recommendations */}
                  {gapAnalysis.recommendations.length > 0 && (
                    <div>
                      <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Recommended Articles
                      </h3>
                      <div className="space-y-2">
                        {gapAnalysis.recommendations.map((idea, idx) => (
                          <div
                            key={idx}
                            className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(idea.estimatedDifficulty)}`}>
                                    {idea.estimatedDifficulty}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVolumeColor(idea.estimatedVolume)}`}>
                                    {idea.estimatedVolume} vol
                                  </span>
                                </div>
                                <p className="font-medium text-slate-800">{idea.keyword}</p>
                                <p className="text-sm text-slate-600">{idea.articleTitle}</p>
                                <p className="text-xs text-slate-500 mt-1">{idea.rationale}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-emerald-600">
                                  <TrendingUp className="w-4 h-4" />
                                  <span className="font-bold">{idea.trafficPotential}</span>
                                </div>
                                <button
                                  onClick={() => handleAddToQueue(idea)}
                                  disabled={addingToQueue.has(idea.keyword) || addedToQueue.has(idea.keyword)}
                                  className={`p-2 rounded-lg ${
                                    addedToQueue.has(idea.keyword)
                                      ? 'bg-green-100 text-green-600'
                                      : 'text-indigo-600 hover:bg-indigo-50'
                                  }`}
                                >
                                  {addingToQueue.has(idea.keyword) ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : addedToQueue.has(idea.keyword) ? (
                                    <Check className="w-5 h-5" />
                                  ) : (
                                    <Plus className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cluster Tab */}
              {activeTab === 'cluster' && clusterResult && (
                <div className="space-y-6">
                  {/* Pillar Page */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-800">Pillar Page</h3>
                    </div>
                    <p className="font-medium text-slate-800 text-lg">{clusterResult.pillarPage?.title}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                      <span>Keyword: <strong>{clusterResult.pillarPage?.keyword}</strong></span>
                      <span>Target: <strong>{clusterResult.pillarPage?.wordCountTarget} words</strong></span>
                    </div>
                    {clusterResult.pillarPage?.outline && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <p className="text-xs text-purple-600 uppercase font-medium mb-2">Outline</p>
                        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                          {clusterResult.pillarPage.outline.map((section: string, i: number) => (
                            <li key={i}>{section}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* Cluster Articles */}
                  <div>
                    <h3 className="font-medium text-slate-800 mb-3">Supporting Articles</h3>
                    <div className="space-y-2">
                      {clusterResult.clusterArticles?.map((article: any, i: number) => (
                        <div key={i} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between hover:border-slate-300 transition-colors">
                          <div>
                            <p className="font-medium text-slate-800">{article.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              <span>{article.keyword}</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{article.contentType}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{article.linksToPillar}</p>
                          </div>
                          <div className="flex items-center gap-1 text-emerald-600">
                            <TrendingUp className="w-4 h-4" />
                            <span className="font-bold">{article.trafficPotential}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interlinking Strategy */}
                  {clusterResult.interlinkingStrategy && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h3 className="font-medium text-slate-800 mb-2">Interlinking Strategy</h3>
                      <p className="text-sm text-slate-600">{clusterResult.interlinkingStrategy}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!activeTab && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Lightbulb className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">Ready to discover keywords?</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Enter your niche above, then choose to generate fresh ideas, find gaps in your existing content, or build a content cluster.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
