import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft, Calendar, Clock, Eye } from 'lucide-react'
import { getPost } from '../../../server/functions/posts'
import { MarkdownRenderer } from '../../../components/MarkdownRenderer'
import { calculateStats, formatReadingTime } from '../../../lib/content-stats'
import { parseFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { ArticleSchema, BreadcrumbSchema } from '../../../components/seo'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    try {
      const post = await getPost({ data: { slug: params.slug } })

      // Only show published posts on public blog
      if (post.directory !== 'published') {
        throw redirect({ to: '/blog' })
      }

      const { body } = parseFrontmatter(post.content)
      const stats = calculateStats(body)

      return { post, body, stats }
    } catch {
      throw redirect({ to: '/blog' })
    }
  },
  component: BlogPostPage
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function BlogPostPage() {
  const { post, body, stats } = Route.useLoaderData()

  // Generate full URL for schema (using relative for now, would need site URL in production)
  const articleUrl = `/blog/${post.slug}`

  return (
    <article className="min-h-screen bg-white" aria-labelledby="article-title">
      {/* JSON-LD Structured Data */}
      <ArticleSchema
        title={post.title}
        description={post.description}
        url={articleUrl}
        image={post.thumbnail}
        datePublished={post.date}
        wordCount={stats.wordCount}
        publisher={{ name: 'arrival-mdCMS' }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.title },
        ]}
      />

      {/* Hero Header */}
      <header className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Back link */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Title */}
          <h1 id="article-title" className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800 leading-tight mb-6">
            {post.title}
          </h1>

          {/* Description */}
          {post.description && (
            <p className="text-xl text-slate-600 mb-6 leading-relaxed">
              {post.description}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(post.date)}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatReadingTime(stats.readingTime)}
            </span>
            {post.views > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {post.views.toLocaleString()} views
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Featured Image */}
      {post.thumbnail && (
        <div className="max-w-5xl mx-auto px-6 -mt-4">
          <div className="aspect-[21/9] rounded-2xl overflow-hidden shadow-xl">
            <img
              src={post.thumbnail}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline">
          <MarkdownRenderer content={body} />
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all articles
          </Link>
        </div>
      </footer>
    </article>
  )
}
