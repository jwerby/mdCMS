import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft, Edit2, Home } from 'lucide-react'
import { getPage, getPages } from '../../server/functions/pages'
import { MarkdownRenderer } from '../../components/editor/MarkdownRenderer'

export const Route = createFileRoute('/$slug')({
  loader: async ({ params }) => {
    try {
      const page = await getPage({ data: { slug: params.slug } })
      const pages = await getPages()
      const navPages = pages.filter(p => p.showInNav).sort((a, b) => a.order - b.order)
      return { page, navPages }
    } catch {
      throw notFound()
    }
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Page Not Found</h1>
        <p className="text-slate-600 mb-8">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
      </div>
    </div>
  ),
  component: PageView,
})

function PageView() {
  const { page, navPages } = Route.useLoaderData()

  // Extract content body (remove frontmatter)
  const bodyMatch = page.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  const body = bodyMatch?.[1] ?? page.content

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
              {navPages.map(navPage => (
                <Link
                  key={navPage.slug}
                  to="/$slug"
                  params={{ slug: navPage.slug }}
                  className={`text-sm font-medium transition-colors ${
                    navPage.slug === page.slug
                      ? 'text-indigo-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
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
          <h1 className="text-4xl font-bold text-slate-900 mb-8">{page.title}</h1>
          <MarkdownRenderer content={body} />
        </article>
      </main>
    </div>
  )
}
