import { describe, expect, test } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

describe('MarkdownRenderer SSR', () => {
  test('does not render debug timing banner on the server', () => {
    const html = renderToString(React.createElement(MarkdownRenderer, { content: '# Title\n\nBody' }))
    expect(html).not.toContain('Static Render')
  })
})
