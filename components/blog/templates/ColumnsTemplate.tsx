import { BlogCard, type BlogPost } from '../BlogCard'
import type { BlogConfig } from '../../../server/functions/site-config'

interface ColumnsTemplateProps {
  posts: BlogPost[]
  config: BlogConfig
}

export function ColumnsTemplate({ posts, config }: ColumnsTemplateProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No posts yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <BlogCard
          key={post.slug}
          post={post}
          variant="default"
          showExcerpt={config.showExcerpt}
          showThumbnail={config.showThumbnail}
          showReadTime={config.showReadTime}
          showDate={config.showDate}
        />
      ))}
    </div>
  )
}
