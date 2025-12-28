import { describe, it, expect } from 'vitest'
import { buildEditorPath } from '../lib/editor-routing'

describe('editor routing', () => {
  it('builds editor path from UUID', () => {
    const path = buildEditorPath('123e4567-e89b-12d3-a456-426614174000')
    expect(path).toBe('/dashboard/editor/123e4567-e89b-12d3-a456-426614174000')
  })
})
