import { describe, expect, test } from 'vitest'
import { buildRefinementPrompt } from '../server/functions/ai/refineArticle'
import { buildApplyFixesPrompt } from '../server/functions/ai/optimize'

describe('guidance injection for refine and optimize', () => {
  test('refinement prompt includes guidance block', () => {
    const prompt = buildRefinementPrompt('# Title\n\nBody', {})
    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })

  test('apply fixes prompt includes guidance block', () => {
    const prompt = buildApplyFixesPrompt({
      content: '# Title\n\nBody',
      recommendations: ['Shorten long paragraphs'],
      frontmatter: {
        meta_title: 'Test',
        primary_keyword: 'test keyword'
      }
    })
    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })
})
