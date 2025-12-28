# Feedback Update (Editor) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an inline “Update with Feedback” panel in the editor that generates a revised draft from user feedback and shows changes in the existing DiffModal before applying.

**Architecture:** A new server function `updateWithFeedback` calls the LLM with the full article (frontmatter + body) and feedback, then returns only the updated body (frontmatter preserved). The editor panel sends full content + feedback, receives the updated body, and uses the existing diff workflow.

**Tech Stack:** TypeScript, TanStack Start, Vitest, existing AI generation utilities.

---

## Task 1: Add failing tests for update-with-feedback server helper

**Files:**
- Create: `tests/update-with-feedback.test.ts`
- (Will reference new helper in `server/functions/ai/updateWithFeedback.ts`)

**Step 1: Write failing tests**

Create `tests/update-with-feedback.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { updateWithFeedbackUsingGenerator } from '../server/functions/ai/updateWithFeedback'

describe('updateWithFeedbackUsingGenerator', () => {
  test('strips AI preamble and frontmatter from response', async () => {
    const original = `---\narticle_id: 123\nmeta_title: Old Title\n---\n# Old\nBody`
    const generateFn = async () => ({
      content: `Sure, here's the update.\n---\nmeta_title: New Title\n---\n# New Title\nUpdated body`,
      provider: 'gemini' as const
    })

    const result = await updateWithFeedbackUsingGenerator(generateFn, {
      content: original,
      feedback: 'Add a stronger conclusion'
    })

    expect(result.content.startsWith('---')).toBe(false)
    expect(result.content).toContain('# New Title')
    expect(result.content).not.toContain('meta_title:')
    expect(result.content.toLowerCase()).not.toContain('sure, here')
  })

  test('handles responses with no frontmatter', async () => {
    const original = `---\narticle_id: 123\nmeta_title: Old Title\n---\n# Old\nBody`
    const generateFn = async () => ({
      content: `Okay, here's the revision.\n# Updated\nNew paragraph`,
      provider: 'anthropic' as const
    })

    const result = await updateWithFeedbackUsingGenerator(generateFn, {
      content: original,
      feedback: 'Tighten section 2'
    })

    expect(result.content.startsWith('---')).toBe(false)
    expect(result.content).toBe('# Updated\nNew paragraph')
  })
})
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/update-with-feedback.test.ts
```
Expected: FAIL because `updateWithFeedbackUsingGenerator` does not exist yet.

---

## Task 2: Implement update-with-feedback server function + prompt

**Files:**
- Create: `server/functions/ai/updateWithFeedback.ts`
- Modify: `server/functions/ai/prompts.ts`

**Step 1: Add prompt template**

In `server/functions/ai/prompts.ts`, add:
```ts
  updateWithFeedback: `You are an expert editor. Apply the user's feedback to the article.

CRITICAL RULES:
1. PRESERVE frontmatter exactly as-is
2. ONLY edit the article body
3. Maintain the original voice and structure
4. Apply ONLY the feedback provided

ABSOLUTELY FORBIDDEN:
- No preambles like "Sure, here's..."
- No explanations or meta-commentary
- Do NOT add or remove frontmatter fields

Return ONLY the updated article (frontmatter + body or body only).`
```

**Step 2: Implement server function and helper**

Create `server/functions/ai/updateWithFeedback.ts`:
```ts
import { createServerFn } from '@tanstack/react-start'
import { generate, type AIGenerateOptions, type AIResponse } from './index'
import { PROMPTS } from './prompts'
import { checkRateLimit, RATE_LIMIT_CONFIGS, RateLimitError, getMsUntilReset } from '../../../lib/security/rate-limiter'
import { updateWithFeedbackInputSchema, validateInput } from '../../../lib/validation/schemas'

export interface UpdateWithFeedbackResult {
  content: string
  provider: 'gemini' | 'anthropic'
}

type GenerateFn = (options: AIGenerateOptions) => Promise<AIResponse>

const PREAMBLE_PATTERNS = [
  /^okay,?\s*here'?s?\s*/i,
  /^sure,?\s*here'?s?\s*/i,
  /^here'?s?\s*(a|the|your)?\s*/i,
  /^i'?ve\s*(created|written|prepared|made|updated)\s*/i,
  /^below\s*is\s*/i,
  /^the\s*following\s*is\s*/i,
  /^as\s*requested,?\s*/i,
]

function stripPreamble(text: string): string {
  let result = text.trim()
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of PREAMBLE_PATTERNS) {
      const before = result
      result = result.replace(pattern, '')
      if (result !== before) {
        changed = true
        result = result.trim()
      }
    }
  }
  return result
}

export async function updateWithFeedbackUsingGenerator(
  generateFn: GenerateFn,
  data: { content: string; feedback: string }
): Promise<UpdateWithFeedbackResult> {
  const prompt = `
${PROMPTS.updateWithFeedback}

Feedback:
${data.feedback}

Original Content:
---
${data.content}
---
`

  const result = await generateFn({
    prompt,
    maxTokens: 8192,
    temperature: 0.4
  })

  let newContent = result.content

  // Strip preamble before frontmatter
  const frontmatterStart = newContent.indexOf('---')
  if (frontmatterStart > 0) {
    newContent = newContent.slice(frontmatterStart)
  }

  // Remove frontmatter block if present, return body only
  const bodyMatch = newContent.match(/^---[\\s\\S]*?---\\n([\\s\\S]*)$/)
  let bodyContent = bodyMatch ? bodyMatch[1].trim() : newContent.replace(/^---[\\s\\S]*?---\\n?/, '').trim()

  bodyContent = stripPreamble(bodyContent)

  if (!bodyContent.startsWith('#')) {
    const firstHeadingIndex = bodyContent.search(/^#\\s+/m)
    if (firstHeadingIndex > 0) {
      bodyContent = bodyContent.slice(firstHeadingIndex)
    }
  }

  return {
    content: bodyContent,
    provider: result.provider
  }
}

export const updateWithFeedback = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateInput(updateWithFeedbackInputSchema, data))
  .handler(async ({ data }): Promise<UpdateWithFeedbackResult> => {
    const ip = 'default'
    if (!checkRateLimit(ip, RATE_LIMIT_CONFIGS.ai_generation)) {
      const retryAfterMs = getMsUntilReset(ip, RATE_LIMIT_CONFIGS.ai_generation)
      throw new RateLimitError(retryAfterMs, 0)
    }

    return updateWithFeedbackUsingGenerator(generate, data)
  })
```

**Step 3: Run tests**

Run:
```bash
npm test -- tests/update-with-feedback.test.ts
```
Expected: PASS.

---

## Task 3: Add “Update with Feedback” panel in editor

**Files:**
- Modify: `app/routes/dashboard/editor.$slug.tsx`

**Step 1: Import server function**

Add:
```ts
import { updateWithFeedback } from '../../../server/functions/ai/updateWithFeedback'
```

**Step 2: Add state**

Add near other state hooks:
```ts
const [showFeedbackPanel, setShowFeedbackPanel] = useState(false)
const [feedbackText, setFeedbackText] = useState('')
const [isGeneratingUpdate, setIsGeneratingUpdate] = useState(false)
```

**Step 3: Add handler**

Add:
```ts
const handleGenerateUpdate = async () => {
  if (!content.trim() || isGeneratingUpdate) return
  const trimmed = feedbackText.trim()
  if (trimmed.length < 5) {
    addToast('Please add more detailed feedback.', 'error')
    return
  }

  setIsGeneratingUpdate(true)

  try {
    const effectiveFrontmatter = {
      ...frontmatter,
      published_date: frontmatter.published_date || new Date().toISOString().split('T')[0]
    }
    const merged = mergePostFrontmatter(rawFrontmatter, effectiveFrontmatter)
    const fullContent = `${serializeFrontmatter(merged)}\\n${content}`

    const result = await updateWithFeedback({
      data: { content: fullContent, feedback: trimmed }
    })

    setPendingRewrite({
      original: content,
      newContent: result.content,
      provider: result.provider
    })
    addToast('Update generated. Review changes.', 'success')
  } catch {
    addToast('Failed to generate update', 'error')
  } finally {
    setIsGeneratingUpdate(false)
  }
}
```

**Step 4: Insert panel UI above the editor**

Insert after the SEO panel and before “Editor + Preview”:
```tsx
      {/* Update with Feedback Panel */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setShowFeedbackPanel(s => !s)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="font-medium">Update with Feedback</span>
          {showFeedbackPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFeedbackPanel && (
          <div className="px-4 pb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Feedback</label>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what to add, fix, or improve..."
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Be specific about sections, facts, or conclusions you want improved.
              </span>
              <button
                onClick={handleGenerateUpdate}
                disabled={isGeneratingUpdate || feedbackText.trim().length < 5 || !content.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingUpdate ? 'Generating...' : 'Generate Update'}
              </button>
            </div>
          </div>
        )}
      </div>
```

**Step 5: Run tests**

Run:
```bash
npm test -- tests/update-with-feedback.test.ts
```
Expected: PASS.

---

## Task 4: Manual verification

1. Start dev server: `npm run dev`
2. Open a post in the editor.
3. Expand “Update with Feedback,” enter feedback (e.g., “Add a stronger conclusion”), click “Generate Update.”
4. Confirm DiffModal opens and updated body appears (frontmatter unchanged).

---

## Notes on git

This workspace doesn’t appear to be a git repository. If you want commits, initialize git or point me at the actual repo root before implementation.

