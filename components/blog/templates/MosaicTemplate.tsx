import { BlogCard, type BlogPost } from '../BlogCard'
import type { BlogConfig } from '../../../server/functions/site-config'

interface MosaicTemplateProps {
  posts: BlogPost[]
  config: BlogConfig
}

export function MosaicTemplate({ posts, config }: MosaicTemplateProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No posts yet. Check back soon!</p>
      </div>
    )
  }

  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
      {posts.map((post, index) => {
        // Every 4th post (0, 4, 8...) gets the featured treatment for visual variety
        const isFeatured = index % 4 === 0

        return (
          <div key={post.slug} className="break-inside-avoid mb-6">
            <BlogCard
              post={post}
              variant={isFeatured ? 'default' : 'compact'}
              showExcerpt={isFeatured ? config.showExcerpt : false}
              showThumbnail={config.showThumbnail}
              showReadTime={config.showReadTime}
              showDate={config.showDate}
            />
          </div>
        )
      })}
    </div>
  )
}
