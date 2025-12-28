function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n/, '').trim()
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/[*_~>`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function anchorizeRawUrls(markdown: string): string {
  const urlRegex = /(^|\s)(https?:\/\/[^\s)]+)/g
  return markdown.replace(urlRegex, (match, prefix, url) => {
    let label = 'Learn more'
    try {
      const parsed = new URL(url)
      label = parsed.hostname.replace(/^www\./, '')
    } catch {
      label = 'Learn more'
    }
    return `${prefix}[${label}](${url})`
  })
}

export function cleanMetaDescription(content: string, meta: string): string {
  const text = stripMarkdown(stripFrontmatter(content))
  let description = meta?.trim() || ''

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? []
  if (description && sentences.length > 0) {
    const target = description.toLowerCase()
    const index = sentences.findIndex((sentence) => {
      const normalized = sentence.trim().toLowerCase()
      return normalized === target || normalized.endsWith(` ${target}`)
    })
    if (index >= 0) {
      description = text.replace(sentences[index], '').trim()
    }
  }

  if (description && text.toLowerCase().startsWith(description.toLowerCase())) {
    description = text.slice(description.length).trim()
  }

  if (!description) {
    description = text
  }

  if (description.length > 160) {
    description = description.slice(0, 160).replace(/\s+\S*$/, '')
  }

  return description.replace(/\s+/g, ' ').trim()
}
