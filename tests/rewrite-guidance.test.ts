import { describe, expect, test } from 'vitest'
import { buildRewritePrompt, postprocessRewrittenContent } from '../server/functions/ai/rewrite'

describe('rewrite guidance and postprocess', () => {
  test('rewrite prompt includes guidance block', () => {
    const original = `---\nmeta_title: Virginia Beach Guide\nprimary_keyword: virginia beach guide\n---\n# Title\nBody`
    const prompt = buildRewritePrompt({
      originalContent: original,
      targetKeyword: 'virginia beach guide',
      instructions: 'Tighten the intro'
    })

    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })

  test('postprocess anchors raw URLs and preserves article_id', () => {
    const content = `---\nmeta_title: Test\n---\n# Heading\nVisit https://example.com/guide for details.`
    const result = postprocessRewrittenContent({
      content,
      fallbackArticleId: 'abc-123'
    })

    expect(result).toContain('article_id: abc-123')
    expect(result).toContain('[example.com](https://example.com/guide)')
  })
})
