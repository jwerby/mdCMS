import { expect, test } from 'vitest'
import { buildWritePrompt } from '../server/functions/ai/write'
import { buildGuidanceBlock, buildContentProfile } from '../lib/content-guidance'

test('write prompt includes geo entities when location detected', () => {
  const profile = buildContentProfile({
    topic: 'Virginia Beach startup guide',
    primaryKeyword: 'virginia beach startup guide',
    draft: 'Virginia Beach is part of Hampton Roads.'
  })
  const guidance = buildGuidanceBlock(profile)
  const prompt = buildWritePrompt({
    topic: 'Virginia Beach startup guide',
    primaryKeyword: 'virginia beach startup guide',
  })

  expect(guidance).toMatch(/Hampton Roads/i)
  expect(prompt).toContain(guidance)
})
