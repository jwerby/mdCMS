import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  TrendingUp,
  Target,
  TrendingDown,
  Plus,
  CheckSquare,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import {
  getStrikingDistanceOpportunities,
  getLowCTROpportunities,
  getDecliningOpportunities,
  getOpportunitySummary
} from '../../../../server/functions/seo-planner/opportunities'
import { bulkAddFromOpportunities } from '../../../../server/functions/seo-planner/article-queue'
import { requireAuth } from '../../../../lib/auth-utils'
import { useToastStore } from '../../../../lib/store'

type TabType = 'striking' | 'lowctr' | 'declining'

interface Opportunity {
  id: number
  keyword: string
  pageUrl: string | null
  impressions: number
  clicks: number
  ctr: number
  position: number
  priorityScore: number
  positionDrop?: number
}

export const Route = createFileRoute('/dashboard/seo-planner/opportunities')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const [summary, strikingDistance, lowCtr, declining] = await Promise.all([
      getOpportunitySummary(),
      getStrikingDistanceOpportunities({ data: { limit: 50, offset: 0, minImpressions: 50 } }),
      getLowCTROpportunities({ data: { limit: 50, offset: 0, minImpressions: 100, maxCtr: 0.02 } }),
      getDecliningOpportunities({ data: { limit: 50, offset: 0, minImpressions: 50, minDrop: 3 } })
    ])
    return { summary, strikingDistance, lowCtr, declining }
  },
  component: OpportunitiesPage
})

function OpportunitiesPage() {
  const { summary, strikingDistance, lowCtr, declining } = Route.useLoaderData()
  const { addToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<TabType>('striking')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = useState(false)

  const opportunities: Record<TabType, Opportunity[]> = {
    striking: strikingDistance,
    lowctr: lowCtr,
    declining: declining
  }

  const currentOpportunities = opportunities[activeTab]

  const toggleSelect = (keyword: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword)
    } else {
      newSelected.add(keyword)
    }
    setSelected(newSelected)
  }

  const selectAll = () => {
    if (selected.size === currentOpportunities.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(currentOpportunities.map(o => o.keyword)))
    }
  }

  const addToQueue = async () => {
    if (selected.size === 0) {
      addToast('Please select at least one keyword', 'error')
      return
    }

    setIsAdding(true)
    try {
      const selectedOpps = currentOpportunities
        .filter(o => selected.has(o.keyword))
        .map(o => ({
          keyword: o.keyword,
          priorityScore: o.priorityScore,
          estimatedTraffic: Math.round(o.impressions * 0.1) // Rough estimate
        }))

      await bulkAddFromOpportunities({
        data: {
          opportunities: selectedOpps,
          category: activeTab === 'striking' ? 'Striking Distance' :
            activeTab === 'lowctr' ? 'CTR Optimization' : 'Recovery'
        }
      })

      addToast(`Added ${selected.size} keywords to article queue`, 'success')
      setSelected(new Set())
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add to queue', 'error')
    } finally {
      setIsAdding(false)
    }
  }

  const tabs: Array<{ id: TabType; label: string; icon: typeof TrendingUp; count: number; color: string }> = [
    {
      id: 'striking',
      label: 'Striking Distance',
      icon: Target,
      count: summary.opportunities.strikingDistance.count,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      id: 'lowctr',
      label: 'Low CTR',
      icon: TrendingUp,
      count: summary.opportunities.lowCtr.count,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      id: 'declining',
      label: 'Declining',
      icon: TrendingDown,
      count: summary.opportunities.declining.count,
      color: 'text-red-600 bg-red-50'
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/seo-planner" className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Keyword Opportunities</h1>
                <p className="text-sm text-slate-500">
                  {summary.totalKeywords} keywords tracked
                </p>
              </div>
            </div>

            {selected.size > 0 && (
              <button
                onClick={addToQueue}
                disabled={isAdding}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {isAdding ? 'Adding...' : `Add ${selected.size} to Queue`}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`bg-white rounded-xl border border-slate-200 p-4 cursor-pointer transition-all ${
                activeTab === tab.id ? 'ring-2 ring-indigo-500' : 'hover:border-slate-300'
              }`}
              onClick={() => {
                setActiveTab(tab.id)
                setSelected(new Set())
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tab.color}`}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{tab.count}</p>
                  <p className="text-sm text-slate-500">{tab.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Description */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          {activeTab === 'striking' && (
            <p className="text-sm text-slate-600">
              <strong>Striking Distance:</strong> Keywords ranking between positions 11-30 with good impressions.
              These are your best opportunities - a small improvement could put you on page 1.
            </p>
          )}
          {activeTab === 'lowctr' && (
            <p className="text-sm text-slate-600">
              <strong>Low CTR:</strong> Keywords with high impressions but click-through rate below 2%.
              Improve your titles and meta descriptions to capture more clicks.
            </p>
          )}
          {activeTab === 'declining' && (
            <p className="text-sm text-slate-600">
              <strong>Declining:</strong> Keywords where your position has dropped 3+ spots recently.
              These pages may need content updates or technical fixes.
            </p>
          )}
        </div>

        {/* Opportunities Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {currentOpportunities.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No opportunities found in this category.</p>
              <p className="text-sm text-slate-500 mt-1">
                Make sure you've synced data from Google Search Console.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={selectAll}
                        className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700"
                      >
                        <CheckSquare className={`w-4 h-4 ${selected.size === currentOpportunities.length ? 'text-indigo-600' : ''}`} />
                        Select
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Keyword
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Impressions
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Clicks
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentOpportunities.map(opp => (
                    <tr
                      key={opp.keyword}
                      className={`hover:bg-slate-50 cursor-pointer ${
                        selected.has(opp.keyword) ? 'bg-indigo-50' : ''
                      }`}
                      onClick={() => toggleSelect(opp.keyword)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(opp.keyword)}
                          onChange={() => toggleSelect(opp.keyword)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800 truncate max-w-xs">
                            {opp.keyword}
                          </p>
                          {opp.pageUrl && (
                            <a
                              href={opp.pageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                              onClick={e => e.stopPropagation()}
                            >
                              {new URL(opp.pageUrl).pathname}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {opp.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {opp.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {(opp.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          opp.position <= 10 ? 'bg-green-100 text-green-700' :
                          opp.position <= 20 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {opp.position.toFixed(1)}
                          {opp.positionDrop && (
                            <TrendingDown className="w-3 h-3 ml-1" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${Math.min(100, opp.priorityScore)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">
                            {opp.priorityScore.toFixed(0)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
