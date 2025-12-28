import { describe, expect, test } from 'vitest'
import { buildWritePrompt } from '../server/functions/ai/write'
import { buildResearchPrompt } from '../server/functions/ai/research'

describe('AI prompt guidance injection', () => {
  test('write prompt includes guidance block', () => {
    const prompt = buildWritePrompt({
      topic: 'How to start a business in Virginia Beach',
      primaryKeyword: 'start a business in virginia beach',
    })
    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })

  test('research prompt includes guidance block', () => {
    const prompt = buildResearchPrompt({ topic: 'Modern CSS architecture' })
    expect(prompt).toMatch(/\[GUIDANCE\]/)
  })
})
