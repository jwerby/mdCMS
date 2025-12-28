import { describe, expect, test } from 'vitest'
import { buildSEOMetadata } from '../lib/seo/seo-metadata'

describe('buildSEOMetadata', () => {
  test('parses full SEO metadata response', () => {
    const raw = `META_TITLE: Example Title
META_DESCRIPTION: Example description that is long enough.
PRIMARY_KEYWORD: Sample Keyword
SECONDARY_KEYWORDS: Alpha, Beta, Gamma`

    const result = buildSEOMetadata(raw, {
      content: '# Heading\n\nBody text here.'
    })

    expect(result.metaTitle).toBe('Example Title')
    expect(result.metaDescription).toBe('Example description that is long enough.')
    expect(result.primaryKeyword).toBe('sample keyword')
    expect(result.secondaryKeywords).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('fills missing fields when only meta title is provided', () => {
    const raw = 'META_TITLE: 2200 Parks Avenue: The Case for a Virginia Beach P3'
    const content = `# The Case for a P3 Community Hub at 2200 Parks Avenue

**A public-private partnership is the proven model for Virginia Beach's former MOCA building.**

The building at 2200 Parks Avenue has stood at Virginia Beach's gateway to the Oceanfront since 1989.`

    const result = buildSEOMetadata(raw, { content })

    expect(result.metaTitle).toBe('2200 Parks Avenue: The Case for a Virginia Beach P3')
    expect(result.metaDescription.length).toBeGreaterThan(0)
    expect(result.metaDescription.length).toBeLessThanOrEqual(160)
    expect(result.primaryKeyword).toBe('2200 parks avenue')
    expect(result.secondaryKeywords.length).toBeGreaterThan(0)
  })

  test('parses JSON SEO metadata response', () => {
    const raw = `{\n  \"metaTitle\": \"Example Title\",\n  \"metaDescription\": \"Example description that is long enough.\",\n  \"primaryKeyword\": \"Sample Keyword\",\n  \"secondaryKeywords\": [\"Alpha\", \"Beta\", \"Gamma\"]\n}`

    const result = buildSEOMetadata(raw, {
      content: '# Heading\\n\\nBody text here.'
    })

    expect(result.metaTitle).toBe('Example Title')
    expect(result.metaDescription).toBe('Example description that is long enough.')
    expect(result.primaryKeyword).toBe('sample keyword')
    expect(result.secondaryKeywords).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('replaces truncated meta title with content H1', () => {
    const raw = 'META_TITLE: 2200 Parks Avenue: The Case for a Virginia Beach P'
    const content = `# The Case for a P3 Community Hub at 2200 Parks Avenue

Body text here.`

    const result = buildSEOMetadata(raw, { content })

    expect(result.metaTitle).toBe('The Case for a P3 Community Hub at 2200 Parks Avenue')
  })
})
