import { describe, expect, test } from 'vitest'
import { buildSeoPrompt, generateSEOMetadataWithGenerator } from '../server/functions/ai/generateSEO'

describe('generateSEOMetadataWithGenerator', () => {
  test('SEO prompt includes guidance block', () => {
    const prompt = buildSeoPrompt({ content: '# Heading\n\nBody text here.' }, 1)
    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })

  test('retries when first response is not valid JSON', async () => {
    let calls = 0
    const generateFn = async () => {
      calls += 1
      if (calls === 1) {
        return {
          content: 'META_TITLE: Example Title',
          provider: 'gemini' as const,
        }
      }
      return {
        content: `{\n  \"metaTitle\": \"Example Title\",\n  \"metaDescription\": \"Example description that is long enough.\",\n  \"primaryKeyword\": \"Sample Keyword\",\n  \"secondaryKeywords\": [\"Alpha\", \"Beta\", \"Gamma\"]\n}`,
        provider: 'gemini' as const,
      }
    }

    const result = await generateSEOMetadataWithGenerator(generateFn, {
      content: '# Heading\n\nBody text here.',
    })

    expect(calls).toBe(2)
    expect(result.metaDescription).toBe('Example description that is long enough.')
    expect(result.primaryKeyword).toBe('sample keyword')
    expect(result.secondaryKeywords).toEqual(['alpha', 'beta', 'gamma'])
  })
})
