export interface PostEditorFrontmatter {
  meta_title: string
  meta_description: string
  primary_keyword: string
  secondary_keywords: string
  url_slug: string
  published_date: string
  thumbnail: string
}

export interface PageEditorFrontmatter {
  title: string
  description: string
  meta_title: string
  meta_description: string
  template: string
  order: number
  show_in_nav: boolean
  nav_label: string
}

const POST_ALIAS_KEYS = [
  'Meta Title',
  'Meta Description',
  'Primary Keyword',
  'Secondary Keywords',
  'URL Slug'
]

export function getPostEditorFrontmatter(raw: Record<string, unknown>): PostEditorFrontmatter {
  const secondary = raw.secondary_keywords ?? raw['Secondary Keywords'] ?? ''
  const secondaryStr = Array.isArray(secondary) ? secondary.join(', ') : String(secondary ?? '')

  return {
    meta_title: String(raw.meta_title ?? raw['Meta Title'] ?? raw.title ?? ''),
    meta_description: String(raw.meta_description ?? raw['Meta Description'] ?? raw.description ?? ''),
    primary_keyword: String(raw.primary_keyword ?? raw['Primary Keyword'] ?? ''),
    secondary_keywords: secondaryStr,
    url_slug: String(raw.url_slug ?? raw['URL Slug'] ?? ''),
    published_date: String(raw.published_date ?? ''),
    thumbnail: String(raw.thumbnail ?? raw.schema_image ?? '')
  }
}

export function mergePostFrontmatter(
  raw: Record<string, unknown>,
  ui: PostEditorFrontmatter
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...raw }
  for (const key of POST_ALIAS_KEYS) delete merged[key]

  const secondary = ui.secondary_keywords
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  merged.meta_title = ui.meta_title || undefined
  merged.meta_description = ui.meta_description || undefined
  merged.primary_keyword = ui.primary_keyword || undefined
  merged.secondary_keywords = secondary.length ? secondary : undefined
  merged.url_slug = ui.url_slug || undefined
  merged.published_date = ui.published_date || undefined
  merged.thumbnail = ui.thumbnail || undefined

  return merged
}

export function getPageEditorFrontmatter(raw: Record<string, unknown>): PageEditorFrontmatter {
  return {
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    meta_title: String(raw.meta_title ?? ''),
    meta_description: String(raw.meta_description ?? ''),
    template: String(raw.template ?? 'default'),
    order: typeof raw.order === 'number' ? raw.order : parseInt(String(raw.order ?? '0'), 10) || 0,
    show_in_nav: typeof raw.show_in_nav === 'boolean' ? raw.show_in_nav : String(raw.show_in_nav) === 'true',
    nav_label: String(raw.nav_label ?? '')
  }
}

export function mergePageFrontmatter(
  raw: Record<string, unknown>,
  ui: PageEditorFrontmatter
): Record<string, unknown> {
  return {
    ...raw,
    title: ui.title || undefined,
    description: ui.description || undefined,
    meta_title: ui.meta_title || undefined,
    meta_description: ui.meta_description || undefined,
    template: ui.template || undefined,
    order: ui.order,
    show_in_nav: ui.show_in_nav,
    nav_label: ui.nav_label || undefined
  }
}
