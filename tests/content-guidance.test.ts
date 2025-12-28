import { describe, expect, test } from 'vitest'
import { buildContentProfile, buildGuidanceBlock } from '../lib/content-guidance'

describe('content guidance', () => {
  test('detects geo using curated map', () => {
    const profile = buildContentProfile({
      topic: 'How to start a business in Virginia Beach',
      primaryKeyword: 'start a business in virginia beach',
      secondaryKeywords: ['hampton roads'],
      draft: 'Virginia Beach entrepreneurs need to consider BPOL.',
    })

    expect(profile.geo?.name).toBe('virginia beach')
    expect(profile.geo?.isDetected).toBe(true)
    expect(profile.suggestedEntities.length).toBeGreaterThan(0)
  })

  test('does not apply geo enrichment when no region detected', () => {
    const profile = buildContentProfile({
      topic: 'Modern CSS architecture',
      primaryKeyword: 'css architecture',
      draft: 'This is a global technical guide.',
    })

    expect(profile.geo).toBeNull()
    const guidance = buildGuidanceBlock(profile)
    expect(guidance).not.toMatch(/local entities/i)
  })

  test('flags keyword stuffing in early content', () => {
    const profile = buildContentProfile({
      topic: 'AI copywriting',
      primaryKeyword: 'ai copywriting',
      draft: 'AI copywriting is great. AI copywriting helps. AI copywriting works for teams.',
    })

    expect(profile.riskFlags).toContain('keyword_stuffing')
  })
})
