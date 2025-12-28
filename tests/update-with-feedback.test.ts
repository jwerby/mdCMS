import { describe, expect, test } from 'vitest'
import { updateWithFeedbackUsingGenerator } from '../server/functions/ai/updateWithFeedback'

describe('updateWithFeedbackUsingGenerator', () => {
  test('strips AI preamble and frontmatter from response', async () => {
    const original = `---\narticle_id: 123\nmeta_title: Old Title\n---\n# Old\nBody`
    const generateFn = async () => ({
      content: `Sure, here's the update.\n---\nmeta_title: New Title\n---\n# New Title\nUpdated body`,
      provider: 'gemini' as const
    })

    const result = await updateWithFeedbackUsingGenerator(generateFn, {
      content: original,
      feedback: 'Add a stronger conclusion'
    })

    expect(result.content.startsWith('---')).toBe(false)
    expect(result.content).toContain('# New Title')
    expect(result.content).not.toContain('meta_title:')
    expect(result.content.toLowerCase()).not.toContain('sure, here')
  })

  test('handles responses with no frontmatter', async () => {
    const original = `---\narticle_id: 123\nmeta_title: Old Title\n---\n# Old\nBody`
    const generateFn = async () => ({
      content: `Okay, here's the revision.\n# Updated\nNew paragraph`,
      provider: 'anthropic' as const
    })

    const result = await updateWithFeedbackUsingGenerator(generateFn, {
      content: original,
      feedback: 'Tighten section 2'
    })

    expect(result.content.startsWith('---')).toBe(false)
    expect(result.content).toBe('# Updated\nNew paragraph')
  })

  test('converts raw URLs to anchor text in updated content', async () => {
    const original = `---\narticle_id: 123\nmeta_title: Old Title\n---\n# Old\nBody`
    const generateFn = async () => ({
      content: `---\nmeta_title: New Title\n---\n# New Title\nVisit https://example.com/guide for details.`,
      provider: 'gemini' as const
    })

    const result = await updateWithFeedbackUsingGenerator(generateFn, {
      content: original,
      feedback: 'Add a resource link'
    })

    expect(result.content).toContain('[example.com](https://example.com/guide)')
  })
})
