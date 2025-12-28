import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Search, FileText, RefreshCw, Sparkles, BarChart3, Eraser, TrendingUp } from 'lucide-react'
import { requireAuth } from '../../../lib/auth-utils'

export const Route = createFileRoute('/seo/')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: SEOCommandCenter,
})

const commands = [
  {
    name: 'Research',
    slug: 'research',
    description: 'Keyword research, competitor analysis, and content briefs',
    icon: <Search className="w-6 h-6" />,
    color: 'indigo',
    status: 'ready'
  },
  {
    name: 'Write',
    slug: 'write',
    description: 'Generate 2000-3000+ word SEO-optimized articles',
    icon: <FileText className="w-6 h-6" />,
    color: 'emerald',
    status: 'ready'
  },
  {
    name: 'Rewrite',
    slug: 'rewrite',
    description: 'Update and improve existing content',
    icon: <RefreshCw className="w-6 h-6" />,
    color: 'blue',
    status: 'ready'
  },
  {
    name: 'Optimize',
    slug: 'optimize',
    description: 'SEO scoring and actionable improvements',
    icon: <Sparkles className="w-6 h-6" />,
    color: 'amber',
    status: 'ready'
  },
  {
    name: 'Analyze',
    slug: 'analyze',
    description: 'Content gap analysis for existing posts',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'purple',
    status: 'ready'
  },
  {
    name: 'Scrub',
    slug: 'scrub',
    description: 'Remove AI watermarks and telltale signs',
    icon: <Eraser className="w-6 h-6" />,
    color: 'rose',
    status: 'ready'
  },
  {
    name: 'Performance',
    slug: 'performance',
    description: 'Content portfolio analysis and priority queue',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'teal',
    status: 'ready'
  }
]

const colorClasses = {
  indigo: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
  emerald: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
  blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
  amber: 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
  purple: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
  rose: 'bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
  teal: 'bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
} as const

function SEOCommandCenter() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="font-bold text-slate-800">SEO Machine</h1>
              <p className="text-xs text-slate-500">AI-powered content optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              Gemini + Claude
            </span>
            <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">Cmd+K</kbd>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-slate-900 mb-4">
            7 Commands. Infinite Content.
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Research, write, optimize, and publish SEO-ready content
            with AI-powered assistance at every step.
          </p>
        </div>

        {/* Command Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {commands.map(cmd => (
            <Link
              key={cmd.slug}
              to={`/seo/${cmd.slug}` as any}
              className={`group bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-xl hover:border-slate-300 transition-all ${
                cmd.status === 'coming' ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${colorClasses[cmd.color as keyof typeof colorClasses]}`}>
                  {cmd.icon}
                </div>
                {cmd.status === 'coming' && (
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                    Coming Soon
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">/{cmd.name.toLowerCase()}</h3>
              <p className="text-sm text-slate-500">{cmd.description}</p>
            </Link>
          ))}
        </div>

        {/* Workflow Hint */}
        <div className="mt-16 p-8 bg-slate-900 rounded-3xl text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Recommended Workflow</h3>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="px-4 py-2 bg-indigo-600 rounded-lg">1. Research</span>
            <span className="text-slate-400">→</span>
            <span className="px-4 py-2 bg-emerald-600 rounded-lg">2. Write</span>
            <span className="text-slate-400">→</span>
            <span className="px-4 py-2 bg-rose-600 rounded-lg">3. Scrub</span>
            <span className="text-slate-400">→</span>
            <span className="px-4 py-2 bg-amber-600 rounded-lg">4. Optimize</span>
          </div>
          <p className="mt-6 text-slate-400 text-sm">
            Start with research to understand your target keywords,
            then generate content, remove AI markers, and optimize for SEO.
          </p>
        </div>
      </main>
    </div>
  )
}
