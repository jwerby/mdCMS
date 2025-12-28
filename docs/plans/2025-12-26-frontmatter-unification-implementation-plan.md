# Frontmatter Unification (A1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify frontmatter parsing/serialization across editors and server utilities while preserving unknown keys and preventing data corruption from colons/quotes/newlines.

**Architecture:** Centralize frontmatter parsing/serialization in `lib/markdown/frontmatter-parser.ts`, add thin helper utilities to map raw frontmatter into editor UI state and merge it back on save. Editors become wiring: parse content once, store raw frontmatter, and serialize merged frontmatter on save.

**Tech Stack:** TypeScript, React (TanStack Start), Vite, Vitest (new), existing frontmatter parser.

---

## Task 1: Add minimal test harness (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Add Vitest devDependency and test scripts**

Update `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Add `vitest.config.ts`**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

**Step 3: Install deps**

Run:
```bash
npm install
```
Expected: packages install cleanly.

**Step 4: Commit**
```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test harness"
```

---

## Task 2: Write failing tests for frontmatter parsing/serialization

**Files:**
- Create: `tests/frontmatter-parser.test.ts`

**Step 1: Write failing tests**

Create `tests/frontmatter-parser.test.ts`:
```ts
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
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/frontmatter-parser.test.ts
```
Expected: FAIL because serializer does not quote/escape and parser does not unescape.

**Step 3: Commit**
```bash
git add tests/frontmatter-parser.test.ts
git commit -m "test: add frontmatter parser round-trip cases"
```

---

## Task 3: Implement robust serialization + parsing in frontmatter parser

**Files:**
- Modify: `lib/markdown/frontmatter-parser.ts`

**Step 1: Implement escape/unescape helpers + array parsing**

Update `lib/markdown/frontmatter-parser.ts` with helpers:
```ts
function needsQuoting(value: string): boolean {
  return /[:\n"\[\],]/.test(value)
}

function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function unescapeValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function splitArrayItems(input: string): string[] {
  const items: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"' && input[i - 1] !== '\\') {
      inQuotes = !inQuotes
      current += ch
      continue
    }
    if (ch === ',' && !inQuotes) {
      items.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) items.push(current.trim())
  return items
}
```

Update array parsing:
```ts
if (value.startsWith('[') && value.endsWith(']')) {
  const inner = value.slice(1, -1).trim()
  const rawItems = inner ? splitArrayItems(inner) : []
  frontmatter[key] = rawItems.map(item => {
    const trimmed = item.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return unescapeValue(trimmed.slice(1, -1))
    }
    return trimmed
  })
}
```

Update quoted string parsing:
```ts
else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
  frontmatter[key] = unescapeValue(value.slice(1, -1))
}
```

Update serialization:
```ts
if (Array.isArray(value)) {
  const rendered = value.map((item) => {
    const s = String(item)
    return needsQuoting(s) ? `"${escapeValue(s)}"` : s
  })
  lines.push(`${key}: [${rendered.join(', ')}]`)
} else if (typeof value === 'string') {
  const safe = needsQuoting(value) ? `"${escapeValue(value)}"` : value
  lines.push(`${key}: ${safe}`)
}
```

**Step 2: Run tests (green)**

Run:
```bash
npm test -- tests/frontmatter-parser.test.ts
```
Expected: PASS.

**Step 3: Commit**
```bash
git add lib/markdown/frontmatter-parser.ts
git commit -m "feat: harden frontmatter serialization and parsing"
```

---

## Task 4: Write failing tests for editor frontmatter merging

**Files:**
- Create: `tests/frontmatter-utils.test.ts`

**Step 1: Write failing tests**

Create `tests/frontmatter-utils.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mergePostFrontmatter, mergePageFrontmatter } from '../lib/markdown/frontmatter-utils'

describe('frontmatter utils', () => {
  it('merges post frontmatter, removes aliases, preserves unknowns', () => {
    const raw = {
      'Meta Title': 'Old',
      'Secondary Keywords': 'legacy',
      custom_field: 'keep'
    }
    const ui = {
      meta_title: 'New',
      meta_description: 'Desc',
      primary_keyword: 'Primary',
      secondary_keywords: 'alpha, two, three',
      url_slug: '/blog/test',
      published_date: '2025-12-26',
      thumbnail: ''
    }

    const merged = mergePostFrontmatter(raw, ui)
    expect(merged).toMatchObject({
      meta_title: 'New',
      meta_description: 'Desc',
      primary_keyword: 'Primary',
      url_slug: '/blog/test',
      published_date: '2025-12-26',
      custom_field: 'keep',
      secondary_keywords: ['alpha', 'two', 'three']
    })
    expect(merged).not.toHaveProperty('Meta Title')
    expect(merged).not.toHaveProperty('Secondary Keywords')
  })

  it('merges page frontmatter and preserves unknowns', () => {
    const raw = { custom_field: 'keep' }
    const ui = {
      title: 'Page',
      description: 'Desc',
      meta_title: 'Meta',
      meta_description: 'Meta Desc',
      template: 'default',
      order: 2,
      show_in_nav: true,
      nav_label: 'Nav'
    }

    const merged = mergePageFrontmatter(raw, ui)
    expect(merged).toMatchObject({
      title: 'Page',
      order: 2,
      show_in_nav: true,
      custom_field: 'keep'
    })
  })
})
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/frontmatter-utils.test.ts
```
Expected: FAIL because `frontmatter-utils` does not exist yet.

**Step 3: Commit**
```bash
git add tests/frontmatter-utils.test.ts
git commit -m "test: define frontmatter merge expectations"
```

---

## Task 5: Implement frontmatter helper utilities

**Files:**
- Create: `lib/markdown/frontmatter-utils.ts`

**Step 1: Implement helpers**

Create `lib/markdown/frontmatter-utils.ts`:
```ts
export interface PostEditorFrontmatter {
  meta_title: string
  meta_description: string
  primary_keyword: string
  secondary_keywords: string
  url_slug: string
  published_date: string
  thumbnail: string
}

export interface PageEditorFrontmatter {
  title: string
  description: string
  meta_title: string
  meta_description: string
  template: string
  order: number
  show_in_nav: boolean
  nav_label: string
}

const POST_ALIAS_KEYS = [
  'Meta Title',
  'Meta Description',
  'Primary Keyword',
  'Secondary Keywords',
  'URL Slug'
]

export function getPostEditorFrontmatter(raw: Record<string, unknown>): PostEditorFrontmatter {
  const secondary = raw.secondary_keywords ?? raw['Secondary Keywords'] ?? ''
  const secondaryStr = Array.isArray(secondary) ? secondary.join(', ') : String(secondary ?? '')

  return {
    meta_title: String(raw.meta_title ?? raw['Meta Title'] ?? raw.title ?? ''),
    meta_description: String(raw.meta_description ?? raw['Meta Description'] ?? raw.description ?? ''),
    primary_keyword: String(raw.primary_keyword ?? raw['Primary Keyword'] ?? ''),
    secondary_keywords: secondaryStr,
    url_slug: String(raw.url_slug ?? raw['URL Slug'] ?? ''),
    published_date: String(raw.published_date ?? ''),
    thumbnail: String(raw.thumbnail ?? raw.schema_image ?? '')
  }
}

export function mergePostFrontmatter(
  raw: Record<string, unknown>,
  ui: PostEditorFrontmatter
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...raw }
  for (const key of POST_ALIAS_KEYS) delete merged[key]

  const secondary = ui.secondary_keywords
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  merged.meta_title = ui.meta_title || undefined
  merged.meta_description = ui.meta_description || undefined
  merged.primary_keyword = ui.primary_keyword || undefined
  merged.secondary_keywords = secondary.length ? secondary : undefined
  merged.url_slug = ui.url_slug || undefined
  merged.published_date = ui.published_date || undefined
  merged.thumbnail = ui.thumbnail || undefined

  return merged
}

export function getPageEditorFrontmatter(raw: Record<string, unknown>): PageEditorFrontmatter {
  return {
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    meta_title: String(raw.meta_title ?? ''),
    meta_description: String(raw.meta_description ?? ''),
    template: String(raw.template ?? 'default'),
    order: typeof raw.order === 'number' ? raw.order : parseInt(String(raw.order ?? '0'), 10) || 0,
    show_in_nav: typeof raw.show_in_nav === 'boolean' ? raw.show_in_nav : String(raw.show_in_nav) === 'true',
    nav_label: String(raw.nav_label ?? '')
  }
}

export function mergePageFrontmatter(
  raw: Record<string, unknown>,
  ui: PageEditorFrontmatter
): Record<string, unknown> {
  return {
    ...raw,
    title: ui.title || undefined,
    description: ui.description || undefined,
    meta_title: ui.meta_title || undefined,
    meta_description: ui.meta_description || undefined,
    template: ui.template || undefined,
    order: ui.order,
    show_in_nav: ui.show_in_nav,
    nav_label: ui.nav_label || undefined
  }
}
```

**Step 2: Run tests (green)**

Run:
```bash
npm test -- tests/frontmatter-utils.test.ts
```
Expected: PASS.

**Step 3: Commit**
```bash
git add lib/markdown/frontmatter-utils.ts
git commit -m "feat: add frontmatter merge utilities"
```

---

## Task 6: Wire post editor to shared parser/serializer + utils

**Files:**
- Modify: `app/routes/dashboard/editor.$slug.tsx`

**Step 1: Update imports and state**

Add imports:
```ts
import { parseFrontmatter, serializeFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { getPostEditorFrontmatter, mergePostFrontmatter, type PostEditorFrontmatter } from '../../../lib/markdown/frontmatter-utils'
```

Add state:
```ts
const [rawFrontmatter, setRawFrontmatter] = useState<Record<string, unknown>>({})
const [frontmatter, setFrontmatter] = useState<PostEditorFrontmatter>({ ... })
```

**Step 2: Replace regex parsing in load + version restore**

Use:
```ts
const { frontmatter: raw, body } = parseFrontmatter(post.content)
setRawFrontmatter(raw)
setFrontmatter(getPostEditorFrontmatter(raw))
setContent(body)
```

**Step 3: Update save to merge + serialize**

Replace manual string building:
```ts
const merged = mergePostFrontmatter(rawFrontmatter, frontmatter)
const fullContent = `${serializeFrontmatter(merged)}\n${content}`
await updatePost({ data: { slug: post.slug, content: fullContent } })
```

**Step 4: Run tests**

Run:
```bash
npm test
```
Expected: PASS.

**Step 5: Commit**
```bash
git add app/routes/dashboard/editor.$slug.tsx
git commit -m "refactor: use shared frontmatter parser in post editor"
```

---

## Task 7: Wire page editor to shared parser/serializer + utils

**Files:**
- Modify: `app/routes/dashboard/page-editor.$slug.tsx`

**Step 1: Update imports and state**

Add imports:
```ts
import { parseFrontmatter, serializeFrontmatter } from '../../../lib/markdown/frontmatter-parser'
import { getPageEditorFrontmatter, mergePageFrontmatter, type PageEditorFrontmatter } from '../../../lib/markdown/frontmatter-utils'
```

Add state:
```ts
const [rawFrontmatter, setRawFrontmatter] = useState<Record<string, unknown>>({})
const [frontmatter, setFrontmatter] = useState<PageEditorFrontmatter>({ ... })
```

**Step 2: Replace regex parsing in load + version restore**

Use:
```ts
const { frontmatter: raw, body } = parseFrontmatter(page.content)
setRawFrontmatter(raw)
setFrontmatter(getPageEditorFrontmatter(raw))
setContent(body)
```

**Step 3: Update save to merge + serialize**

```ts
const merged = mergePageFrontmatter(rawFrontmatter, frontmatter)
const fullContent = `${serializeFrontmatter(merged)}\n${content}`
await updatePage({ data: { slug: page.slug, content: fullContent, frontmatter: merged } })
```

**Step 4: Run tests**

Run:
```bash
npm test
```
Expected: PASS.

**Step 5: Commit**
```bash
git add app/routes/dashboard/page-editor.$slug.tsx
git commit -m "refactor: use shared frontmatter parser in page editor"
```

---

## Task 8: Manual verification (optional but recommended)

**Step 1: Run dev server**
```bash
npm run dev
```

**Step 2: Create/edit a post**
- Add a meta description with `:` and quotes.
- Add secondary keywords containing commas.
- Save, reload, confirm fields round-trip correctly.

**Step 3: Commit docs update (if needed)**
```bash
git add docs/plans/2025-12-26-frontmatter-unification-design.md
```

---

Plan complete.
