import { describe, expect, test } from 'vitest'
import { anchorizeRawUrls, cleanMetaDescription } from '../lib/content-postprocess'

describe('content postprocess', () => {
  test('converts raw URLs to anchor text', () => {
    const input = 'Visit https://example.com/guide for details.'
    const output = anchorizeRawUrls(input)
    expect(output).toContain('[example.com](https://example.com/guide)')
  })

  test('leaves existing markdown links untouched', () => {
    const input = 'See [Example](https://example.com).'
    const output = anchorizeRawUrls(input)
    expect(output).toBe(input)
  })

  test('cleans meta description length and avoids duplicating first sentence', () => {
    const content = '# Title\n\nFirst sentence. Second sentence with more detail and context.'
    const cleaned = cleanMetaDescription(content, 'First sentence.')
    expect(cleaned.length).toBeLessThanOrEqual(160)
    expect(cleaned).not.toMatch(/^First sentence/i)
  })
})
