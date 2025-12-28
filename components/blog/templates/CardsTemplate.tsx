import { BlogCard, type BlogPost } from '../BlogCard'
import type { BlogConfig } from '../../../server/functions/site-config'

interface CardsTemplateProps {
  posts: BlogPost[]
  config: BlogConfig
}

export function CardsTemplate({ posts, config }: CardsTemplateProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No posts yet. Check back soon!</p>
      </div>
    )
  }

  const [featuredPost, ...remainingPosts] = posts

  return (
    <div className="space-y-10">
      {/* Featured Post - Full Width Hero */}
      {featuredPost && (
        <BlogCard
          post={featuredPost}
          variant="featured"
          showExcerpt={config.showExcerpt}
          showThumbnail={config.showThumbnail}
          showReadTime={config.showReadTime}
          showDate={config.showDate}
        />
      )}

      {/* Remaining Posts - Grid */}
      {remainingPosts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {remainingPosts.map((post) => (
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
      )}
    </div>
  )
}
