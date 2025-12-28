import { createFileRoute } from '@tanstack/react-router'
import { getPublishedPosts } from '../../../server/functions/posts'
import { getSiteConfig, defaultBlogConfig } from '../../../server/functions/site-config'
import { calculateStats } from '../../../lib/content-stats'
import { parseFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import {
  BlogHeader,
  ColumnsTemplate,
  CardsTemplate,
  ListTemplate,
  MosaicTemplate,
  type BlogPost
} from '../../../components/blog'

export const Route = createFileRoute('/blog/')({
  loader: async () => {
    const [rawPosts, siteConfig] = await Promise.all([
      getPublishedPosts(),
      getSiteConfig()
    ])

    // Add read time to each post
    const posts: BlogPost[] = rawPosts.map((post) => {
      const { body } = parseFrontmatter(post.content)
      const stats = calculateStats(body)

      return {
        slug: post.slug,
        title: post.title,
        description: post.description,
        date: post.date,
        thumbnail: post.thumbnail,
        readTime: stats.readingTime,
        views: post.views
      }
    })

    const blogConfig = siteConfig.blog ?? defaultBlogConfig

    return { posts, blogConfig }
  },
  component: BlogPage
})

function BlogPage() {
  const { posts, blogConfig } = Route.useLoaderData()

  // Get posts up to the configured limit
  const displayPosts = posts.slice(0, blogConfig.postsPerPage)

  const renderTemplate = () => {
    switch (blogConfig.template) {
      case 'cards':
        return <CardsTemplate posts={displayPosts} config={blogConfig} />
      case 'list':
        return <ListTemplate posts={displayPosts} config={blogConfig} />
      case 'mosaic':
        return <MosaicTemplate posts={displayPosts} config={blogConfig} />
      case 'columns':
      default:
        return <ColumnsTemplate posts={displayPosts} config={blogConfig} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <BlogHeader
          title={blogConfig.title}
          description={blogConfig.description}
          postCount={posts.length}
        />

        {renderTemplate()}
      </div>
    </div>
  )
}
