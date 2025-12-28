interface SEOMetadataBuildResult {
  metaTitle: string
  metaDescription: string
  primaryKeyword: string
  secondaryKeywords: string[]
}

interface BuildOptions {
  content: string
  existingTitle?: string
  existingKeyword?: string
}

const FALLBACK_PRIMARY = '2200 parks avenue'

function normalizeKeyword(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function extractAfterMarker(raw: string, marker: string): string | undefined {
  const regex = new RegExp(`${marker}:\\s*(.+)`, 'i')
  const match = raw.match(regex)
  return match?.[1]?.trim()
}

function extractTitleFromContent(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\n/, '').trim()
  const h1Match = body.match(/^#\s+(.+)$/m)
  if (h1Match?.[1]) {
    return h1Match[1].trim().replace(/[*_~`]+/g, '')
  }

  const firstLine = body.split('\n').map(line => line.trim()).find(Boolean)
  if (!firstLine) return ''
  return firstLine.replace(/^#+\s*/, '').replace(/[*_~`]+/g, '').trim()
}

function isMetaTitleTruncated(title: string): boolean {
  if (!title) return true
  const trimmed = title.trim()
  if (!trimmed) return true
  if (/\.\.\.$/.test(trimmed)) return true
  if (/[:\-—–]$/.test(trimmed)) return true

  const words = trimmed.split(/\s+/)
  const last = words[words.length - 1]
  if (!last) return true

  const commonShort = new Set([
    'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'or', 'and', 'the', 'vs', 'vs.',
    'ai', 'ux', 'ui', 'vr', 'ar', 'seo', 'p3'
  ])
  const lowerLast = last.toLowerCase()
  const hasDigit = /\d/.test(last)
  if (last.length <= 2 && !hasDigit && !commonShort.has(lowerLast)) {
    return true
  }

  return false
}

export function parseJsonMetadata(raw: string): Partial<SEOMetadataBuildResult> | null {
  let jsonStr = raw.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json\\s*/i, '')
    jsonStr = jsonStr.replace(/^```\\s*/i, '')
    jsonStr = jsonStr.replace(/```$/, '').trim()
  }

  if (!jsonStr.startsWith('{')) return null

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    const metaTitle = typeof parsed.metaTitle === 'string' ? parsed.metaTitle.trim() : undefined
    const metaDescription = typeof parsed.metaDescription === 'string' ? parsed.metaDescription.trim() : undefined
    const primaryKeyword = typeof parsed.primaryKeyword === 'string' ? parsed.primaryKeyword.trim() : undefined
    const secondaryKeywords = Array.isArray(parsed.secondaryKeywords)
      ? parsed.secondaryKeywords.filter((k) => typeof k === 'string').map((k) => k.trim())
      : undefined

    return {
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
    }
  } catch {
    return null
  }
}

function buildFallbackDescription(content: string, primaryKeyword: string, metaTitle?: string): string {
  const text = content
    .replace(/^---[\s\S]*?---\n/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/[*_~>`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const keyword = primaryKeyword || FALLBACK_PRIMARY
  const cleanedText = (() => {
    if (!metaTitle) return text
    const normalizedTitle = metaTitle.trim().toLowerCase()
    if (!normalizedTitle) return text
    const normalizedText = text.toLowerCase()
    if (normalizedText.startsWith(normalizedTitle)) {
      return text.slice(metaTitle.length).trim()
    }
    return text
  })()

  const sentenceMatches = cleanedText.match(/[^.!?]+[.!?]+/g) ?? []
  const sentences = sentenceMatches.map(sentence => sentence.trim()).filter(Boolean)

  let description = ''
  for (const sentence of sentences) {
    const candidate = description ? `${description} ${sentence}` : sentence
    if (candidate.length <= 155) {
      description = candidate
      if (description.length >= 120) break
      continue
    }
    if (!description) {
      description = sentence
    }
    break
  }

  if (!description) {
    description = cleanedText
  }

  description = description.replace(/\s+/g, ' ').trim()

  if (keyword && !description.toLowerCase().includes(keyword.toLowerCase())) {
    const prefix = `${keyword} - `
    if (prefix.length + description.length <= 155) {
      description = `${prefix}${description}`.trim()
    }
  }

  if (description.length > 155) {
    let trimmed = description.slice(0, 155)
    trimmed = trimmed.replace(/\s+\S*$/, '')
    description = trimmed.replace(/[.,;:!?-]+$/g, '').trim()
  }

  return description
}

function buildFallbackSecondary(primaryKeyword: string, metaTitle: string): string[] {
  const keywords = new Set<string>()
  const primary = primaryKeyword || FALLBACK_PRIMARY
  keywords.add(primary)

  const titleTerms = metaTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(term => term.length > 3)

  for (const term of titleTerms) {
    if (keywords.size >= 4) break
    if (term !== primary) keywords.add(term)
  }

  return Array.from(keywords).filter(Boolean)
}

export function buildSEOMetadata(raw: string, options: BuildOptions): SEOMetadataBuildResult {
  const jsonParsed = parseJsonMetadata(raw)

  const extractedTitle = jsonParsed?.metaTitle || extractAfterMarker(raw, 'META_TITLE')?.trim() || options.existingTitle || ''
  const contentTitle = extractTitleFromContent(options.content)
  const metaTitle = isMetaTitleTruncated(extractedTitle) && contentTitle
    ? contentTitle
    : extractedTitle
  const metaDescription = jsonParsed?.metaDescription || extractAfterMarker(raw, 'META_DESCRIPTION')?.trim() || ''
  const primaryKeyword = normalizeKeyword(
    jsonParsed?.primaryKeyword || extractAfterMarker(raw, 'PRIMARY_KEYWORD') || options.existingKeyword || ''
  )
  const secondaryKeywordsRaw = extractAfterMarker(raw, 'SECONDARY_KEYWORDS') || ''
  const secondaryKeywords = jsonParsed?.secondaryKeywords
    ? jsonParsed.secondaryKeywords.map(k => k.trim().toLowerCase()).filter(Boolean)
    : secondaryKeywordsRaw
      ? secondaryKeywordsRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : []

  const resolvedPrimary = primaryKeyword || FALLBACK_PRIMARY
  const resolvedDescription = metaDescription || buildFallbackDescription(options.content, resolvedPrimary, metaTitle)
  const resolvedSecondary = secondaryKeywords.length > 0
    ? secondaryKeywords
    : buildFallbackSecondary(resolvedPrimary, metaTitle)

  return {
    metaTitle,
    metaDescription: resolvedDescription,
    primaryKeyword: resolvedPrimary,
    secondaryKeywords: resolvedSecondary,
  }
}
