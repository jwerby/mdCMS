import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { getPost } from '../../server/functions/posts'
import { MarkdownRenderer } from '../../components/editor/MarkdownRenderer'

export const Route = createFileRoute('/post/$slug')({
  loader: async ({ params }) => {
    const post = await getPost({ data: { slug: params.slug } })
    return { post }
  },
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()

  // Extract content body (remove frontmatter)
  const bodyMatch = post.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  const body = bodyMatch?.[1] ?? post.content

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="font-medium text-slate-800 truncate max-w-md">{post.title}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`px-2 py-0.5 rounded-full ${
                  post.directory === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {post.directory === 'published' ? 'Published' : 'Draft'}
                </span>
                <span>{post.date}</span>
              </div>
            </div>
          </div>
          <Link
            to="/dashboard/editor/$slug"
            params={{ slug: post.id ?? post.slug }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <MarkdownRenderer content={body} />
      </main>
    </div>
  )
}
