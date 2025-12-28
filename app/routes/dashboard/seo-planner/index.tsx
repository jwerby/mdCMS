import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Settings,
  Target,
  List,
  RefreshCw,
  TrendingUp,
  Search,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Lightbulb
} from 'lucide-react'
import { getGSCConnectionStatus } from '../../../../server/functions/gsc/oauth'
import { getSyncStatus, quickSync, fullSync } from '../../../../server/functions/gsc/sync'
import { getOpportunitySummary } from '../../../../server/functions/seo-planner/opportunities'
import { getQueueStatistics } from '../../../../server/functions/seo-planner/article-queue'
import { requireAuth } from '../../../../lib/auth-utils'
import { useToastStore } from '../../../../lib/store'

export const Route = createFileRoute('/dashboard/seo-planner/')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const [connectionStatus, syncStatus, opportunities, queueStats] = await Promise.all([
      getGSCConnectionStatus(),
      getSyncStatus(),
      getOpportunitySummary().catch(() => null),
      getQueueStatistics()
    ])
    return { connectionStatus, syncStatus, opportunities, queueStats }
  },
  component: SEOPlannerDashboard
})

function SEOPlannerDashboard() {
  const { connectionStatus, syncStatus, opportunities, queueStats } = Route.useLoaderData()
  const { addToast } = useToastStore()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async (full = false) => {
    setIsSyncing(true)
    try {
      const result = full ? await fullSync() : await quickSync()
      addToast(`Synced ${result.recordsFetched} keywords (${full ? '90' : '7'} days)`, 'success')
      // Reload to refresh data
      window.location.reload()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Sync failed', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">SEO Content Planner</h1>
                <p className="text-sm text-slate-500">
                  Plan and prioritize your content strategy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {connectionStatus.connected && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSync(false)}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                    title="Sync last 7 days"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Quick Sync'}
                  </button>
                  <button
                    onClick={() => handleSync(true)}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 font-medium"
                    title="Sync last 90 days"
                  >
                    Full Sync
                  </button>
                </div>
              )}
              <Link
                to="/dashboard/seo-planner/settings"
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Connection Status Banner */}
        {!connectionStatus.connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">Connect to Google Search Console</p>
              <p className="text-sm text-amber-700">
                To see keyword opportunities and sync data, connect your Google Search Console account.
              </p>
            </div>
            <Link
              to="/dashboard/seo-planner/settings"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Connect
            </Link>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connection Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connectionStatus.connected ? 'bg-green-50' : 'bg-slate-100'}`}>
                {connectionStatus.connected ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-500">GSC Status</p>
                <p className="font-semibold text-slate-800">
                  {connectionStatus.connected ? 'Connected' : 'Not Connected'}
                </p>
              </div>
            </div>
          </div>

          {/* Keywords Tracked */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Search className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Keywords Tracked</p>
                <p className="font-semibold text-slate-800">
                  {opportunities?.totalKeywords.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Total Opportunities */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Opportunities</p>
                <p className="font-semibold text-slate-800">
                  {opportunities
                    ? (opportunities.opportunities.strikingDistance.count +
                       opportunities.opportunities.lowCtr.count +
                       opportunities.opportunities.declining.count).toLocaleString()
                    : 0
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Queue Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">In Queue</p>
                <p className="font-semibold text-slate-800">
                  {queueStats.total}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Last Sync Info */}
        {syncStatus.lastSync && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-600">
                  Last sync: <span className="font-medium">{new Date(syncStatus.lastSync.startedAt).toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {syncStatus.lastSync.recordsFetched} records • {syncStatus.lastSync.type} sync •
                  Date range: {syncStatus.lastSync.dateRange.start} to {syncStatus.lastSync.dateRange.end}
                </p>
              </div>
              {syncStatus.lastSync.status === 'failed' && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  {syncStatus.lastSync.error}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Opportunities Card */}
          <Link
            to="/dashboard/seo-planner/opportunities"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  Keyword Opportunities
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Discover keywords where you can improve rankings and traffic.
                </p>

                {opportunities && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <p className="text-lg font-bold text-emerald-600">
                        {opportunities.opportunities.strikingDistance.count}
                      </p>
                      <p className="text-xs text-slate-500">Striking</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <p className="text-lg font-bold text-amber-600">
                        {opportunities.opportunities.lowCtr.count}
                      </p>
                      <p className="text-xs text-slate-500">Low CTR</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <p className="text-lg font-bold text-red-600">
                        {opportunities.opportunities.declining.count}
                      </p>
                      <p className="text-xs text-slate-500">Declining</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Article Queue Card */}
          <Link
            to="/dashboard/seo-planner/queue"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-50 group-hover:bg-purple-100 transition-colors">
                <List className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  Article Queue
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Manage your content pipeline from idea to published.
                </p>

                <div className="mt-4 grid grid-cols-5 gap-1">
                  {(['idea', 'research', 'outline', 'draft', 'published'] as const).map((status, i) => {
                    const count = queueStats.byStatus[status]
                    const colors = [
                      'bg-purple-500',
                      'bg-blue-500',
                      'bg-amber-500',
                      'bg-orange-500',
                      'bg-green-500'
                    ]
                    return (
                      <div key={status} className="text-center">
                        <div
                          className={`h-2 rounded-full ${colors[i]}`}
                          style={{ opacity: count > 0 ? 1 : 0.2 }}
                        />
                        <p className="text-xs text-slate-500 mt-1 capitalize">{count}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Link>

          {/* Keyword Ideation Card */}
          <Link
            to="/dashboard/seo-planner/ideate"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all group md:col-span-2"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors">
                <Lightbulb className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  Keyword Ideation
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Generate AI-powered keyword ideas for new content. Perfect for greenfield sites or exploring new topics.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">AI-Powered</span>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">Content Clusters</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Low Competition Keywords</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Traffic Potential */}
        {opportunities && opportunities.opportunities.strikingDistance.trafficPotential > 0 && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Traffic Potential</h3>
            </div>
            <p className="text-3xl font-bold">
              +{(opportunities.opportunities.strikingDistance.trafficPotential +
                 opportunities.opportunities.lowCtr.trafficPotential).toLocaleString()}
            </p>
            <p className="text-indigo-100 mt-1">
              estimated monthly clicks if you optimize your striking distance and low CTR keywords
            </p>
          </div>
        )}

        {/* Quick Tips */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Getting Started</h3>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                1
              </span>
              <span>
                <strong>Connect GSC</strong> - Link your Google Search Console to import keyword data
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                2
              </span>
              <span>
                <strong>Find Opportunities</strong> - Browse striking distance keywords and low CTR pages
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                3
              </span>
              <span>
                <strong>Build Queue</strong> - Add high-priority keywords to your article queue
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                4
              </span>
              <span>
                <strong>Create Content</strong> - Move articles through your pipeline as you write
              </span>
            </li>
          </ol>
        </div>
      </main>
    </div>
  )
}
