import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '../lib/markdown/frontmatter-parser'

const roundTrip = (fm: Record<string, unknown>) => {
  const md = `${serializeFrontmatter(fm)}\nBody`
  return parseFrontmatter(md).frontmatter
}

describe('frontmatter parser/serializer', () => {
  it('round-trips colons and quotes safely', () => {
    const fm = { meta_description: 'A: "B"' }
    const serialized = serializeFrontmatter(fm)
    expect(serialized).toContain('"A: \\"B\\""')
    expect(roundTrip(fm)).toEqual(fm)
  })

  it('round-trips newlines and arrays with commas', () => {
    const fm = {
      summary: 'Line1\nLine2',
      secondary_keywords: ['alpha', 'two, three', 'x:y']
    }
    expect(roundTrip(fm)).toEqual(fm)
  })
})
