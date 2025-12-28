# Content Guidance Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable guidance layer, hybrid hyperlocal enrichment, and deterministic post-processing so every AI content flow produces higher-quality, less-stuffed, better-structured output.

**Architecture:** Create a `ContentProfile` + `GuidanceBlock` module, inject guidance into AI prompts, and apply a deterministic post-processor to enforce anchor text, meta-description quality, and heading hygiene. Geo enrichment should be applied only when a region is detected (curated map first, inference second).

**Tech Stack:** Node.js, TypeScript, React Start server functions, Vitest.

**Note:** This repo appears not to be a git repository. Commit steps below should be skipped if `git` is unavailable.

---

### Task 1: Add Content Guidance module + geo map (TDD)

**Files:**
- Create: `lib/content-guidance.ts`
- Create: `context/geo-entities.json`
- Test: `tests/content-guidance.test.ts`

**Step 1: Write the failing tests**

```ts
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
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/content-guidance.test.ts`  
Expected: FAIL (module `lib/content-guidance.ts` not found)

**Step 3: Implement minimal `content-guidance` module**

```ts
// lib/content-guidance.ts
import fs from 'fs'
import path from 'path'

export type ContentType = 'how-to' | 'list' | 'case-study' | 'editorial' | 'guide' | 'general'

export interface GeoMatch {
  name: string
  isDetected: boolean
  entities: string[]
  acronyms: string[]
  programs: string[]
}

export interface ContentProfileInput {
  topic: string
  primaryKeyword: string
  secondaryKeywords?: string[]
  draft?: string
  outline?: string[]
  feedback?: string
}

export interface ContentProfile {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  contentType: ContentType
  geo: GeoMatch | null
  riskFlags: string[]
  suggestedEntities: string[]
}

const isServer = typeof window === 'undefined'
const GEO_PATH = isServer ? path.join(process.cwd(), 'context', 'geo-entities.json') : ''

type GeoEntitiesMap = Record<string, {
  synonyms?: string[]
  entities?: string[]
  acronyms?: string[]
  programs?: string[]
}>

function loadGeoEntities(): GeoEntitiesMap {
  if (!isServer || !GEO_PATH || !fs.existsSync(GEO_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(GEO_PATH, 'utf-8')) as GeoEntitiesMap
  } catch {
    return {}
  }
}

function detectContentType(topic: string): ContentType {
  const lower = topic.toLowerCase()
  if (lower.startsWith('how to') || lower.includes('how to')) return 'how-to'
  if (lower.startsWith('best ') || lower.includes('top ')) return 'list'
  if (lower.includes('case study') || lower.includes('case for')) return 'case-study'
  if (lower.includes('guide')) return 'guide'
  return 'general'
}

function detectGeo(topic: string, draft: string, keywords: string[]): GeoMatch | null {
  const haystack = [topic, draft, ...keywords].join(' ').toLowerCase()
  const map = loadGeoEntities()

  for (const [name, data] of Object.entries(map)) {
    const variants = [name, ...(data.synonyms ?? [])].map(v => v.toLowerCase())
    if (variants.some(v => haystack.includes(v))) {
      return {
        name,
        isDetected: true,
        entities: data.entities ?? [],
        acronyms: data.acronyms ?? [],
        programs: data.programs ?? [],
      }
    }
  }

  // fallback: simple city/state pattern (non-curated)
  if (/\b[a-z]+\s+[a-z]+\b,\s?[a-z]{2}\b/i.test(haystack)) {
    return { name: 'inferred', isDetected: true, entities: [], acronyms: [], programs: [] }
  }

  return null
}

function detectKeywordStuffing(primary: string, draft: string): boolean {
  if (!primary || !draft) return false
  const lowerDraft = draft.toLowerCase()
  const phrase = primary.toLowerCase().trim()
  if (!phrase) return false
  const count = lowerDraft.split(phrase).length - 1
  return count >= 3
}

export function buildContentProfile(input: ContentProfileInput): ContentProfile {
  const primaryKeyword = input.primaryKeyword?.trim() || input.topic
  const secondaryKeywords = input.secondaryKeywords ?? []
  const draft = input.draft ?? ''
  const geo = detectGeo(input.topic, draft, [primaryKeyword, ...secondaryKeywords])
  const riskFlags: string[] = []
  if (detectKeywordStuffing(primaryKeyword, draft)) {
    riskFlags.push('keyword_stuffing')
  }

  return {
    topic: input.topic,
    primaryKeyword,
    secondaryKeywords,
    contentType: detectContentType(input.topic),
    geo: geo && geo.name !== 'inferred' ? geo : (geo?.name === 'inferred' ? null : null),
    riskFlags,
    suggestedEntities: geo?.entities ?? [],
  }
}

export function buildGuidanceBlock(profile: ContentProfile): string {
  const lines: string[] = []
  lines.push('[GUIDANCE]')
  lines.push('- Avoid repeated exact keyword phrases; use semantic variation.')
  lines.push('- Use short paragraphs (max 4 sentences) and bold key terms for scannability.')
  lines.push('- End with a clear, audience-aligned CTA.')
  lines.push('- Convert raw URLs to descriptive anchor text.')
  if (profile.geo?.isDetected) {
    lines.push('- If geo-specific: include 3–6 local entities, 1–2 local acronyms, and 1–2 local programs/organizations.')
    if (profile.suggestedEntities.length) {
      lines.push(`- Local entities to include: ${profile.suggestedEntities.join(', ')}`)
    }
  }
  lines.push('[/GUIDANCE]')
  return lines.join('\n')
}
```

**Step 4: Add geo entities map**

```json
{
  "virginia beach": {
    "synonyms": ["vb", "virginia beach, va", "hampton roads", "tidewater"],
    "entities": ["Hampton Roads", "Tidewater", "Virginia Beach HIVE", "757 Angels"],
    "acronyms": ["BPOL", "SCC", "SWaM"],
    "programs": ["Virginia Beach Economic Development", "Hampton Roads Chamber"]
  }
}
```

**Step 5: Run tests to verify pass**

Run: `npm test -- tests/content-guidance.test.ts`  
Expected: PASS

**Step 6: Commit**

```bash
git add lib/content-guidance.ts context/geo-entities.json tests/content-guidance.test.ts
git commit -m "feat: add content guidance with geo detection"
```

---

### Task 2: Add deterministic post-processing module (TDD)

**Files:**
- Create: `lib/content-postprocess.ts`
- Test: `tests/content-postprocess.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import { anchorizeRawUrls, cleanMetaDescription } from '../lib/content-postprocess'

describe('content postprocess', () => {
  test('converts raw URLs to anchor text', () => {
    const input = 'Visit https://example.com/guide for details.'
    const output = anchorizeRawUrls(input)
    expect(output).toContain('[example.com](https://example.com/guide)')
  })

  test('leaves existing markdown links untouched', () => {
    const input = 'See [Example](https://example.com).'
    const output = anchorizeRawUrls(input)
    expect(output).toBe(input)
  })

  test('cleans meta description length and avoids truncation', () => {
    const content = '# Title\\n\\nFirst sentence. Second sentence with more detail.'
    const cleaned = cleanMetaDescription(content, 'First sentence.')
    expect(cleaned.length).toBeLessThanOrEqual(160)
    expect(cleaned).not.toMatch(/\\.$/)
  })
})
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/content-postprocess.test.ts`  
Expected: FAIL (module not found)

**Step 3: Implement minimal post-processing**

```ts
// lib/content-postprocess.ts
export function anchorizeRawUrls(markdown: string): string {
  const urlRegex = /(^|\\s)(https?:\\/\\/[^\\s)]+)/g
  return markdown.replace(urlRegex, (match, prefix, url) => {
    if (match.includes('](')) return match
    let label = 'Learn more'
    try {
      const parsed = new URL(url)
      label = parsed.hostname.replace(/^www\\./, '')
    } catch {
      label = 'Learn more'
    }
    return `${prefix}[${label}](${url})`
  })
}

export function cleanMetaDescription(content: string, meta: string): string {
  const text = content.replace(/^---[\\s\\S]*?---\\n/, '').replace(/\\s+/g, ' ').trim()
  let description = meta?.trim() || ''
  if (description && text.startsWith(description)) {
    description = text.slice(description.length).trim()
  }
  if (!description) description = text.slice(0, 160)
  if (description.length > 160) {
    description = description.slice(0, 160).replace(/\\s+\\S*$/, '')
  }
  return description.replace(/[.,;:!?-]+$/g, '').trim()
}
```

**Step 4: Run tests to verify pass**

Run: `npm test -- tests/content-postprocess.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add lib/content-postprocess.ts tests/content-postprocess.test.ts
git commit -m "feat: add deterministic content postprocessing"
```

---

### Task 3: Inject guidance into write + research prompts (TDD)

**Files:**
- Modify: `server/functions/ai/write.ts`
- Modify: `server/functions/ai/research.ts`
- Test: `tests/ai-prompt-guidance.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import { buildWritePrompt } from '../server/functions/ai/write'
import { buildResearchPrompt } from '../server/functions/ai/research'

describe('AI prompt guidance injection', () => {
  test('write prompt includes guidance block', () => {
    const prompt = buildWritePrompt({
      topic: 'How to start a business in Virginia Beach',
      primaryKeyword: 'start a business in virginia beach',
    })
    expect(prompt).toMatch(/\\[GUIDANCE\\]/)
  })

  test('research prompt includes guidance block', () => {
    const prompt = buildResearchPrompt({ topic: 'Modern CSS architecture' })
    expect(prompt).toMatch(/\\[GUIDANCE\\]/)
  })
})
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/ai-prompt-guidance.test.ts`  
Expected: FAIL (exported builders missing)

**Step 3: Refactor prompt creation and inject guidance**

Example for `write.ts`:

```ts
import { buildContentProfile, buildGuidanceBlock } from '../../../lib/content-guidance'

export function buildWritePrompt(data: WriteInput): string {
  const profile = buildContentProfile({
    topic: data.topic,
    primaryKeyword: data.primaryKeyword,
    secondaryKeywords: data.secondaryKeywords,
    outline: data.outline,
    researchBrief: data.researchBrief,
  } as any)
  const guidance = buildGuidanceBlock(profile)

  return `
${PROMPTS.write}

${guidance}

Topic: ${data.topic}
Primary Keyword: ${data.primaryKeyword}
${data.secondaryKeywords?.length ? `Secondary Keywords: ${data.secondaryKeywords.join(', ')}` : ''}
Target Word Count: ${data.targetWordCount ?? 2500}+

${data.outline?.length ? `Suggested Outline:\\n${data.outline.map((h, i) => `${i + 1}. ${h}`).join('\\n')}` : ''}

${data.researchBrief ? `Research Brief:\\n${data.researchBrief}` : ''}
`
}
```

Then use `buildWritePrompt` in `runWrite` to generate the prompt.  
Repeat with `buildResearchPrompt` in `research.ts`.

**Step 4: Run tests to verify pass**

Run: `npm test -- tests/ai-prompt-guidance.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/functions/ai/write.ts server/functions/ai/research.ts tests/ai-prompt-guidance.test.ts
git commit -m "feat: inject guidance into write and research prompts"
```

---

### Task 4: Apply guidance + postprocess to rewrite + feedback update (TDD)

**Files:**
- Modify: `server/functions/ai/rewrite.ts`
- Modify: `server/functions/ai/updateWithFeedback.ts`
- Modify: `tests/update-with-feedback.test.ts`

**Step 1: Add failing test for postprocess in feedback update**

```ts
import { updateWithFeedbackUsingGenerator } from '../server/functions/ai/updateWithFeedback'

test('feedback update converts raw URLs to anchor text', async () => {
  const generateFn = async () => ({
    content: '---\\nmeta_title: Test\\n---\\nVisit https://example.com.',
    provider: 'gemini' as const,
  })

  const result = await updateWithFeedbackUsingGenerator(generateFn, {
    content: '# Title',
    feedback: 'Add a link',
  })

  expect(result.content).toContain('[example.com](https://example.com)')
})
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/update-with-feedback.test.ts`  
Expected: FAIL (no anchorization yet)

**Step 3: Implement guidance + postprocess**

- In `updateWithFeedback.ts`, build a ContentProfile from `content` + `feedback`, inject guidance into prompt, then postprocess `bodyContent` with `anchorizeRawUrls`.
- In `rewrite.ts`, build ContentProfile from topic/keyword + original content and inject guidance into prompt. Apply `anchorizeRawUrls` to final content before saving.

**Step 4: Run tests to verify pass**

Run: `npm test -- tests/update-with-feedback.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/functions/ai/updateWithFeedback.ts server/functions/ai/rewrite.ts tests/update-with-feedback.test.ts
git commit -m "feat: apply guidance and postprocessing to rewrite/update"
```

---

### Task 5: Apply guidance to SEO metadata + refine/fix flows (TDD)

**Files:**
- Modify: `server/functions/ai/generateSEO.ts`
- Modify: `server/functions/ai/refineArticle.ts`
- Modify: `server/functions/ai/optimize.ts` (applyFixes prompt path)
- Test: `tests/seo-generate-retry.test.ts`

**Step 1: Add failing test for guidance in SEO prompt**

```ts
import { buildSeoPrompt } from '../server/functions/ai/generateSEO'

test('SEO prompt includes guidance block', () => {
  const prompt = buildSeoPrompt({ content: '# Title' }, 1)
  expect(prompt).toMatch(/\\[GUIDANCE\\]/)
})
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/seo-generate-retry.test.ts`  
Expected: FAIL (buildSeoPrompt not exported / guidance missing)

**Step 3: Implement**

- Export `buildSeoPrompt` and inject guidance using ContentProfile (topic inferred from content H1).
- In `refineArticle.ts`, append guidance block in “strict mode” (only scannability/CTA/anchor rules) to avoid changing structure.
- In `optimize.ts` applyFixes prompt, include guidance in strict mode to avoid rewriting.
- Apply `cleanMetaDescription` when building SEO metadata if metaDescription equals first sentence.

**Step 4: Run tests to verify pass**

Run: `npm test -- tests/seo-generate-retry.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/functions/ai/generateSEO.ts server/functions/ai/refineArticle.ts server/functions/ai/optimize.ts tests/seo-generate-retry.test.ts
git commit -m "feat: add guidance to SEO/refine/fix prompts"
```

---

### Task 6: Add integration test for guidance end-to-end (TDD)

**Files:**
- Test: `tests/ai-guidance-integration.test.ts`

**Step 1: Write the failing test**

```ts
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
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/ai-guidance-integration.test.ts`  
Expected: FAIL (prompt not including guidance yet)

**Step 3: Run tests to verify pass after prior tasks**

Run: `npm test -- tests/ai-guidance-integration.test.ts`  
Expected: PASS

**Step 4: Commit**

```bash
git add tests/ai-guidance-integration.test.ts
git commit -m "test: verify guidance end-to-end prompt injection"
```

---

## Verification

Run:
- `npm test -- tests/content-guidance.test.ts`
- `npm test -- tests/content-postprocess.test.ts`
- `npm test -- tests/ai-prompt-guidance.test.ts`
- `npm test -- tests/update-with-feedback.test.ts`
- `npm test -- tests/seo-generate-retry.test.ts`
- `npm test -- tests/ai-guidance-integration.test.ts`

All should pass with no warnings.

