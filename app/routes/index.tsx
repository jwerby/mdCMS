import { createFileRoute, Link } from '@tanstack/react-router'
import { Edit2 } from 'lucide-react'
import { getPageWithEnhancements, getPages, type Page, type EnhanceConfig } from '../../server/functions/pages'
import { EnhancedPageRenderer } from '../../components/enhanced/EnhancedPageRenderer'

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const { page, enhanceConfig } = await getPageWithEnhancements({ data: { slug: 'home' } })
      const pages = await getPages()
      const navPages = pages.filter((p: Page) => p.showInNav).sort((a: Page, b: Page) => a.order - b.order)
      return { page, enhanceConfig, navPages }
    } catch {
      // No home page exists, return null
      return { page: null, enhanceConfig: null as EnhanceConfig | null, navPages: [] as Page[] }
    }
  },
  component: HomePage,
})

function HomePage() {
  const { page, enhanceConfig, navPages } = Route.useLoaderData()

  // If no home page exists, show a simple landing
  if (!page) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Arrival</h1>
          <p className="text-slate-600 mb-8">Welcome to Arrival</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Extract content body (remove frontmatter)
  const bodyMatch = page.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  const body = bodyMatch?.[1] ?? page.content

  // Use enhanced renderer if enhancement config exists
  if (enhanceConfig) {
    return (
      <div className="min-h-screen bg-white">
        {/* Floating Header for Enhanced Pages */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="font-bold text-white hover:text-white/80 transition-colors drop-shadow-lg"
              >
                Arrival
              </Link>
              <nav className="hidden md:flex items-center gap-4">
                {navPages.map((navPage: Page) => (
                  <Link
                    key={navPage.slug}
                    to="/$slug"
                    params={{ slug: navPage.slug }}
                    className="text-sm font-medium text-white/80 hover:text-white transition-colors drop-shadow"
                  >
                    {navPage.navLabel}
                  </Link>
                ))}
              </nav>
            </div>
            <Link
              to="/dashboard"
              className="p-2 hover:bg-white/10 rounded-lg text-white/80"
              title="Dashboard"
            >
              <Edit2 className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Enhanced Content */}
        <EnhancedPageRenderer content={body} enhanceConfig={enhanceConfig} />
      </div>
    )
  }

  // Fallback to simple rendering
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="font-bold text-slate-800 hover:text-indigo-600 transition-colors"
            >
              Arrival
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              {navPages.map((navPage: Page) => (
                <Link
                  key={navPage.slug}
                  to="/$slug"
                  params={{ slug: navPage.slug }}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {navPage.navLabel}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            to="/dashboard"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            title="Dashboard"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article>
          <EnhancedPageRenderer content={body} />
        </article>
      </main>
    </div>
  )
}
