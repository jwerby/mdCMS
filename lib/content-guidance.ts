import fs from 'fs'
import path from 'path'

export type ContentType = 'how-to' | 'list' | 'case-study' | 'editorial' | 'guide' | 'general'

export interface GeoMatch {
  name: string
  isDetected: boolean
  entities: string[]
  acronyms: string[]
  programs: string[]
}

export interface ContentProfileInput {
  topic: string
  primaryKeyword: string
  secondaryKeywords?: string[]
  draft?: string
  outline?: string[]
  feedback?: string
}

export interface ContentProfile {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  contentType: ContentType
  geo: GeoMatch | null
  riskFlags: string[]
  suggestedEntities: string[]
}

const isServer = typeof window === 'undefined'
const GEO_PATH = isServer ? path.join(process.cwd(), 'context', 'geo-entities.json') : ''

type GeoEntitiesMap = Record<string, {
  synonyms?: string[]
  entities?: string[]
  acronyms?: string[]
  programs?: string[]
}>

function loadGeoEntities(): GeoEntitiesMap {
  if (!isServer || !GEO_PATH || !fs.existsSync(GEO_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(GEO_PATH, 'utf-8')) as GeoEntitiesMap
  } catch {
    return {}
  }
}

function detectContentType(topic: string): ContentType {
  const lower = topic.toLowerCase()
  if (lower.includes('how to') || lower.startsWith('how to')) return 'how-to'
  if (lower.startsWith('best ') || lower.includes('top ')) return 'list'
  if (lower.includes('case study') || lower.includes('case for')) return 'case-study'
  if (lower.includes('guide')) return 'guide'
  return 'general'
}

function detectGeo(topic: string, draft: string, keywords: string[]): GeoMatch | null {
  const haystack = [topic, draft, ...keywords].join(' ').toLowerCase()
  const map = loadGeoEntities()

  for (const [name, data] of Object.entries(map)) {
    const variants = [name, ...(data.synonyms ?? [])].map(v => v.toLowerCase())
    if (variants.some(v => haystack.includes(v))) {
      return {
        name,
        isDetected: true,
        entities: data.entities ?? [],
        acronyms: data.acronyms ?? [],
        programs: data.programs ?? [],
      }
    }
  }

  // fallback: simple city/state pattern (non-curated)
  if (/\b[a-z]+\s+[a-z]+\b,\s?[a-z]{2}\b/i.test(haystack)) {
    return { name: 'inferred', isDetected: true, entities: [], acronyms: [], programs: [] }
  }

  return null
}

function detectKeywordStuffing(primary: string, draft: string): boolean {
  if (!primary || !draft) return false
  const phrase = primary.toLowerCase().trim()
  if (!phrase) return false

  const words = draft.split(/\s+/).slice(0, 600)
  const haystack = words.join(' ').toLowerCase()
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'g')
  const matches = haystack.match(regex)
  return (matches?.length ?? 0) >= 3
}

export function buildContentProfile(input: ContentProfileInput): ContentProfile {
  const primaryKeyword = input.primaryKeyword?.trim() || input.topic
  const secondaryKeywords = input.secondaryKeywords ?? []
  const draft = input.draft ?? ''
  const geo = detectGeo(input.topic, draft, [primaryKeyword, ...secondaryKeywords])
  const riskFlags: string[] = []

  if (detectKeywordStuffing(primaryKeyword, draft)) {
    riskFlags.push('keyword_stuffing')
  }

  return {
    topic: input.topic,
    primaryKeyword,
    secondaryKeywords,
    contentType: detectContentType(input.topic),
    geo,
    riskFlags,
    suggestedEntities: geo?.entities ?? [],
  }
}

export function buildGuidanceBlock(profile: ContentProfile): string {
  const lines: string[] = []
  lines.push('[GUIDANCE]')
  lines.push('- Avoid repeated exact keyword phrases; use semantic variation.')
  lines.push('- Use short paragraphs (max 4 sentences) and bold key terms for scannability.')
  lines.push('- End with a clear, audience-aligned CTA.')
  lines.push('- Convert raw URLs to descriptive anchor text.')
  if (profile.geo?.isDetected) {
    lines.push('- If geo-specific: include 3–6 local entities, 1–2 local acronyms, and 1–2 local programs/organizations.')
    if (profile.suggestedEntities.length) {
      lines.push(`- Local entities to include: ${profile.suggestedEntities.join(', ')}`)
    }
  }
  lines.push('[/GUIDANCE]')
  return lines.join('\n')
}
