import { describe, expect, test } from 'vitest'
import { buildSeoSlug, buildSeoSlugParts } from '../lib/seo/seo-slug'

describe('buildSeoSlug', () => {
  test('uses primary keyword and appends a non-duplicative secondary modifier', () => {
    const result = buildSeoSlug(
      'p3 community hub',
      'The Case for a P3 Community Hub at 2200 Parks Avenue',
      'community hub, public-private partnership'
    )
    expect(result).toBe('/blog/p3-community-hub-public-private-partnership')
  })

  test('falls back to meta title when primary keyword is missing', () => {
    const result = buildSeoSlug('', 'The Case for a P3 Community Hub at 2200 Parks Avenue', 'public-private partnership')
    expect(result).toBe('/blog/the-case-for-a-p3-community-hub-at-2200-parks-avenue')
  })

  test('returns empty string when inputs are empty', () => {
    expect(buildSeoSlug('', '')).toBe('')
  })

  test('buildSeoSlugParts returns slug and urlSlug', () => {
    const result = buildSeoSlugParts('community hub', 'A Guide to Community Hubs', 'p3 model')
    expect(result).toEqual({
      slug: 'community-hub-p3-model',
      urlSlug: '/blog/community-hub-p3-model'
    })
  })
})
