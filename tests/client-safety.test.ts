import { describe, expect, test, vi } from 'vitest'

const throwOnJoin = () => {
  throw new Error('path.join called in client')
}

async function importWithWindow(modulePath: string) {
  vi.stubGlobal('window', {})
  vi.doMock('path', () => ({
    default: { join: throwOnJoin },
    join: throwOnJoin,
  }))

  try {
    return await import(modulePath)
  } finally {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.unmock('path')
  }
}

describe('server modules avoid path.join in client bundles', () => {
  test('posts server functions', async () => {
    await expect(importWithWindow('../server/functions/posts')).resolves.toBeDefined()
  })

  test('optimize server functions', async () => {
    await expect(importWithWindow('../server/functions/ai/optimize')).resolves.toBeDefined()
  })

  test('SEO auto-fix server functions', async () => {
    await expect(importWithWindow('../server/functions/seo-planner/seo-auto-fix')).resolves.toBeDefined()
  })

  test('AI prompts module', async () => {
    await expect(importWithWindow('../server/functions/ai/prompts')).resolves.toBeDefined()
  })
})
