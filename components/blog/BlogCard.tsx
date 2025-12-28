import { Link } from '@tanstack/react-router'
import { Calendar, Clock, Eye, ImageIcon } from 'lucide-react'

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  thumbnail: string | null
  readTime: number
  views: number
}

export interface BlogCardProps {
  post: BlogPost
  variant?: 'default' | 'featured' | 'horizontal' | 'compact'
  showExcerpt?: boolean
  showThumbnail?: boolean
  showReadTime?: boolean
  showDate?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}>
      <ImageIcon className="w-12 h-12 text-slate-300" />
    </div>
  )
}

function PostImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return <ImagePlaceholder className={className} />
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`w-full h-full object-cover ${className}`}
    />
  )
}

function MetaInfo({
  date,
  readTime,
  showDate,
  showReadTime,
  className = ''
}: {
  date: string
  readTime: number
  showDate?: boolean
  showReadTime?: boolean
  className?: string
}) {
  if (!showDate && !showReadTime) return null

  return (
    <div className={`flex items-center gap-3 text-xs text-slate-500 ${className}`}>
      {showDate && (
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(date)}
        </span>
      )}
      {showDate && showReadTime && (
        <span className="w-1 h-1 rounded-full bg-slate-300" />
      )}
      {showReadTime && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {readTime} min read
        </span>
      )}
    </div>
  )
}

// Default card variant - used in Columns template
function DefaultCard({ post, showExcerpt, showThumbnail, showReadTime, showDate }: BlogCardProps) {
  const titleId = `card-title-${post.slug}`

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="block group"
      aria-labelledby={titleId}
    >
      <article className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 h-full flex flex-col">
        {showThumbnail && (
          <div className="aspect-[16/10] overflow-hidden">
            <PostImage
              src={post.thumbnail}
              alt=""
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="p-6 flex-1 flex flex-col">
          <MetaInfo
            date={post.date}
            readTime={post.readTime}
            showDate={showDate}
            showReadTime={showReadTime}
            className="mb-3"
          />

          <h3 id={titleId} className="font-semibold text-slate-800 text-lg mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {post.title}
          </h3>

          {showExcerpt && post.description && (
            <p className="text-slate-600 text-sm line-clamp-2 flex-1">
              {post.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

// Featured card variant - large card for Cards template hero
function FeaturedCard({ post, showExcerpt, showThumbnail, showReadTime, showDate }: BlogCardProps) {
  const titleId = `featured-title-${post.slug}`

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="block group"
      aria-labelledby={titleId}
    >
      <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300">
        <div className="grid md:grid-cols-2 gap-0">
          {showThumbnail && (
            <div className="aspect-[16/10] md:aspect-auto md:min-h-[320px] overflow-hidden">
              <PostImage
                src={post.thumbnail}
                alt=""
                className="group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          <div className="p-8 flex flex-col justify-center">
            <MetaInfo
              date={post.date}
              readTime={post.readTime}
              showDate={showDate}
              showReadTime={showReadTime}
              className="mb-4"
            />

            <h2 id={titleId} className="font-bold text-slate-800 text-2xl md:text-3xl mb-4 group-hover:text-indigo-600 transition-colors line-clamp-3">
              {post.title}
            </h2>

            {showExcerpt && post.description && (
              <p className="text-slate-600 text-base line-clamp-3 mb-4">
                {post.description}
              </p>
            )}

            <span className="inline-flex items-center text-indigo-600 font-medium text-sm group-hover:gap-2 transition-all" aria-hidden="true">
              Read article
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

// Horizontal card variant - used in List template
function HorizontalCard({ post, showExcerpt, showThumbnail, showReadTime, showDate }: BlogCardProps) {
  const titleId = `horizontal-title-${post.slug}`

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="block group"
      aria-labelledby={titleId}
    >
      <article className="flex gap-5 bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-slate-300 transition-all duration-300">
        {showThumbnail && (
          <div className="w-40 h-28 md:w-56 md:h-36 flex-shrink-0 rounded-lg overflow-hidden">
            <PostImage
              src={post.thumbnail}
              alt=""
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
          <MetaInfo
            date={post.date}
            readTime={post.readTime}
            showDate={showDate}
            showReadTime={showReadTime}
            className="mb-2"
          />

          <h3 id={titleId} className="font-semibold text-slate-800 text-lg mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {post.title}
          </h3>

          {showExcerpt && post.description && (
            <p className="text-slate-600 text-sm line-clamp-2 hidden md:block">
              {post.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

// Compact card variant - smaller for Mosaic template
function CompactCard({ post, showExcerpt, showThumbnail, showReadTime, showDate }: BlogCardProps) {
  const titleId = `compact-title-${post.slug}`

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="block group"
      aria-labelledby={titleId}
    >
      <article className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300">
        {showThumbnail && (
          <div className="aspect-[4/3] overflow-hidden">
            <PostImage
              src={post.thumbnail}
              alt=""
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="p-4">
          <MetaInfo
            date={post.date}
            readTime={post.readTime}
            showDate={showDate}
            showReadTime={showReadTime}
            className="mb-2"
          />

          <h3 id={titleId} className="font-medium text-slate-800 text-base group-hover:text-indigo-600 transition-colors line-clamp-2">
            {post.title}
          </h3>

          {showExcerpt && post.description && (
            <p className="text-slate-500 text-sm line-clamp-2 mt-2">
              {post.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

export function BlogCard(props: BlogCardProps) {
  const { variant = 'default' } = props

  switch (variant) {
    case 'featured':
      return <FeaturedCard {...props} />
    case 'horizontal':
      return <HorizontalCard {...props} />
    case 'compact':
      return <CompactCard {...props} />
    default:
      return <DefaultCard {...props} />
  }
}
