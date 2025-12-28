interface BlogHeaderProps {
  title: string
  description?: string
  postCount?: number
}

export function BlogHeader({ title, description, postCount }: BlogHeaderProps) {
  return (
    <header className="text-center mb-12">
      <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4 tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          {description}
        </p>
      )}
      {typeof postCount === 'number' && postCount > 0 && (
        <p className="text-sm text-slate-500 mt-4">
          {postCount} {postCount === 1 ? 'article' : 'articles'}
        </p>
      )}
    </header>
  )
}
