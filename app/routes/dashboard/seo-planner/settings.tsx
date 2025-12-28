import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  FileCheck
} from 'lucide-react'
import {
  saveSiteUrlConfig,
  getGSCConnectionStatus,
  getGSCSettings
} from '../../../../server/functions/gsc/oauth'
import { testGSCConnection, checkCredentialsFile } from '../../../../server/functions/gsc/client'
import { requireAuth } from '../../../../lib/auth-utils'
import { useToastStore } from '../../../../lib/store'

export const Route = createFileRoute('/dashboard/seo-planner/settings')({
  beforeLoad: async () => {
    await requireAuth()
  },
  loader: async () => {
    const [status, settings, credentialsCheck] = await Promise.all([
      getGSCConnectionStatus(),
      getGSCSettings(),
      checkCredentialsFile()
    ])
    return { status, settings, credentialsCheck }
  },
  component: SEOPlannerSettingsPage
})

function SEOPlannerSettingsPage() {
  const { status, settings, credentialsCheck } = Route.useLoaderData()
  const { addToast } = useToastStore()

  const [siteUrl, setSiteUrl] = useState(settings?.siteUrl || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionTest, setConnectionTest] = useState<{ success: boolean; message: string; availableSites?: string[] } | null>(null)

  const handleSaveSiteUrl = async () => {
    if (!siteUrl) {
      addToast('Please enter a site URL', 'error')
      return
    }

    setIsSaving(true)
    try {
      await saveSiteUrlConfig({ data: { siteUrl } })
      addToast('Site URL saved!', 'success')
      setConnectionTest(null)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setConnectionTest(null)
    try {
      const result = await testGSCConnection()
      setConnectionTest({
        success: result.success,
        message: result.success
          ? `Connected! Site: ${result.siteUrl} (${result.permissionLevel})`
          : result.error || 'Unknown error',
        availableSites: result.availableSites
      })
      if (result.success) {
        addToast('Connection successful!', 'success')
      }
    } catch (err) {
      setConnectionTest({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const isReady = credentialsCheck.exists && status.configured

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/seo-planner" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">SEO Planner Settings</h1>
              <p className="text-sm text-slate-500">Configure Google Search Console connection</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Connection Status */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Connection Status</h2>

          <div className="space-y-4">
            {/* Credentials File Status */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50">
              <div className={`p-3 rounded-full ${credentialsCheck.exists ? 'bg-green-100' : 'bg-red-100'}`}>
                {credentialsCheck.exists ? (
                  <FileCheck className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-800">
                  {credentialsCheck.exists ? 'Service Account Credentials Found' : 'Credentials File Missing'}
                </p>
                <p className="text-sm text-slate-500 font-mono">
                  {credentialsCheck.path}
                </p>
              </div>
            </div>

            {/* Site URL Status */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50">
              <div className={`p-3 rounded-full ${status.configured ? 'bg-green-100' : 'bg-amber-100'}`}>
                {status.configured ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-800">
                  {status.configured ? 'Site URL Configured' : 'Site URL Not Set'}
                </p>
                <p className="text-sm text-slate-500">
                  {status.siteUrl || 'Enter your site URL below'}
                </p>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          {isReady && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
              {connectionTest && (
                <div className={`mt-3 p-4 rounded-lg text-sm ${
                  connectionTest.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  <p>{connectionTest.message}</p>
                  {connectionTest.availableSites && connectionTest.availableSites.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Available sites in your Search Console:</p>
                      <ul className="mt-1 list-disc list-inside">
                        {connectionTest.availableSites.map(site => (
                          <li key={site} className="font-mono text-xs">{site}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Site URL Form */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Site Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Site URL
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={e => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Must match the site URL in Google Search Console (include https://)
              </p>
            </div>

            <button
              onClick={handleSaveSiteUrl}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Site URL'}
            </button>
          </div>
        </section>

        {/* Setup Instructions */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-800">Setup Instructions</h2>
          </div>

          <div className="text-sm text-slate-600 space-y-4">
            <p>
              This SEO Planner uses a <strong>Google Service Account</strong> for authentication.
              The credentials file should be placed at:
            </p>
            <code className="block bg-slate-100 px-4 py-2 rounded-lg text-xs">
              content/credentials/google-credentials.json
            </code>

            <div className="pt-4">
              <p className="font-medium text-slate-800 mb-2">To grant access to your site:</p>
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    1
                  </span>
                  <div>
                    <p>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Google Search Console</a></p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    2
                  </span>
                  <div>
                    <p>Select your property → Settings → Users and permissions</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    3
                  </span>
                  <div>
                    <p>Add this service account email with <strong>Full</strong> access:</p>
                    <code className="block mt-1 bg-slate-100 px-3 py-1.5 rounded text-xs break-all">
                      analytics@website-analyzer-463120.iam.gserviceaccount.com
                    </code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    4
                  </span>
                  <div>
                    <p>Enter your site URL above and save</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    5
                  </span>
                  <div>
                    <p>Click "Test Connection" to verify access</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
