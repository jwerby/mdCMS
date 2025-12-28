import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'

describe('editor markup', () => {
  test('does not nest button elements', () => {
    const editorPath = path.join(process.cwd(), 'app', 'routes', 'dashboard', 'editor.$slug.tsx')
    const source = fs.readFileSync(editorPath, 'utf-8')
    const nestedButtonPattern = /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/m

    expect(source).not.toMatch(nestedButtonPattern)
  })
})
