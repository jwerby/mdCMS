const BLOG_PREFIX = '/blog/'
const MAX_URL_SLUG_LENGTH = 75
const MAX_SLUG_LENGTH = MAX_URL_SLUG_LENGTH - BLOG_PREFIX.length

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function trimSlug(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug
  const trimmed = slug.slice(0, maxLength)
  const lastHyphen = trimmed.lastIndexOf('-')
  const safeTrimmed = lastHyphen > 0 ? trimmed.slice(0, lastHyphen) : trimmed
  return safeTrimmed.replace(/-+$/g, '')
}

function normalizeSecondaryKeywords(secondaryKeywords?: string[] | string): string[] {
  if (!secondaryKeywords) return []
  if (Array.isArray(secondaryKeywords)) {
    return secondaryKeywords.map(keyword => keyword.trim()).filter(Boolean)
  }
  return secondaryKeywords
    .split(',')
    .map(keyword => keyword.trim())
    .filter(Boolean)
}

function getSecondaryModifier(secondaryKeywords: string[] | string | undefined, baseSlug: string): string {
  const keywords = normalizeSecondaryKeywords(secondaryKeywords)
  if (keywords.length === 0) return ''

  const baseParts = new Set(baseSlug.split('-').filter(Boolean))

  for (const keyword of keywords) {
    let modifier = slugify(keyword)
    if (!modifier) continue
    const filteredParts = modifier
      .split('-')
      .filter(part => part && !baseParts.has(part))
    if (filteredParts.length === 0) continue
    modifier = filteredParts.join('-')
    return modifier
  }

  return ''
}

export function buildSeoSlug(
  primaryKeyword: string,
  metaTitle: string,
  secondaryKeywords: string[] | string = ''
): string {
  const baseSource = primaryKeyword.trim() ? primaryKeyword : metaTitle
  let baseSlug = slugify(baseSource)
  if (!baseSlug) return ''

  baseSlug = trimSlug(baseSlug, MAX_SLUG_LENGTH)
  let slug = baseSlug

  if (primaryKeyword.trim()) {
    const modifier = getSecondaryModifier(secondaryKeywords, baseSlug)
    if (modifier) {
      const candidate = `${slug}-${modifier}`
      if (candidate.length <= MAX_SLUG_LENGTH) {
        slug = candidate
      } else {
        const remaining = MAX_SLUG_LENGTH - (slug.length + 1)
        if (remaining > 0) {
          const trimmedModifier = trimSlug(modifier, remaining)
          if (trimmedModifier) {
            slug = `${slug}-${trimmedModifier}`
          }
        }
      }
    }
  }

  return `${BLOG_PREFIX}${slug}`
}

export function buildSeoSlugParts(
  primaryKeyword: string,
  metaTitle: string,
  secondaryKeywords: string[] | string = ''
): { slug: string; urlSlug: string } {
  const urlSlug = buildSeoSlug(primaryKeyword, metaTitle, secondaryKeywords)
  const slug = urlSlug
    ? urlSlug.replace(/^\/blog\//, '').replace(/^\//, '')
    : ''
  return { slug, urlSlug }
}
