import { BlogCard, type BlogPost } from '../BlogCard'
import type { BlogConfig } from '../../../server/functions/site-config'

interface ListTemplateProps {
  posts: BlogPost[]
  config: BlogConfig
}

export function ListTemplate({ posts, config }: ListTemplateProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No posts yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {posts.map((post) => (
        <BlogCard
          key={post.slug}
          post={post}
          variant="horizontal"
          showExcerpt={config.showExcerpt}
          showThumbnail={config.showThumbnail}
          showReadTime={config.showReadTime}
          showDate={config.showDate}
        />
      ))}
    </div>
  )
}
