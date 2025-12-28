import { describe, it, expect } from 'vitest'
import { mergePostFrontmatter, mergePageFrontmatter } from '../lib/markdown/frontmatter-utils'

describe('frontmatter utils', () => {
  it('merges post frontmatter, removes aliases, preserves unknowns', () => {
    const raw = {
      'Meta Title': 'Old',
      'Secondary Keywords': 'legacy',
      custom_field: 'keep'
    }
    const ui = {
      meta_title: 'New',
      meta_description: 'Desc',
      primary_keyword: 'Primary',
      secondary_keywords: 'alpha, two, three',
      url_slug: '/blog/test',
      published_date: '2025-12-26',
      thumbnail: ''
    }

    const merged = mergePostFrontmatter(raw, ui)
    expect(merged).toMatchObject({
      meta_title: 'New',
      meta_description: 'Desc',
      primary_keyword: 'Primary',
      url_slug: '/blog/test',
      published_date: '2025-12-26',
      custom_field: 'keep',
      secondary_keywords: ['alpha', 'two', 'three']
    })
    expect(merged).not.toHaveProperty('Meta Title')
    expect(merged).not.toHaveProperty('Secondary Keywords')
  })

  it('merges page frontmatter and preserves unknowns', () => {
    const raw = { custom_field: 'keep' }
    const ui = {
      title: 'Page',
      description: 'Desc',
      meta_title: 'Meta',
      meta_description: 'Meta Desc',
      template: 'default',
      order: 2,
      show_in_nav: true,
      nav_label: 'Nav'
    }

    const merged = mergePageFrontmatter(raw, ui)
    expect(merged).toMatchObject({
      title: 'Page',
      order: 2,
      show_in_nav: true,
      custom_field: 'keep'
    })
  })
})
