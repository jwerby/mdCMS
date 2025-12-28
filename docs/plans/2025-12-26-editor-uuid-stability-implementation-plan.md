# Editor UUID Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure all CMS editor navigation uses immutable post UUIDs so editor URLs remain stable even if `url_slug` changes.

**Architecture:** Keep slug-based public URLs unchanged, but route all internal CMS editor links and create flows to `/dashboard/editor/<article_id>`. Add a small test to enforce this behavior.

**Tech Stack:** TypeScript, React (TanStack Start), Vitest.

---

### Task 1: Add a failing test for dashboard editor links using UUID

**Files:**
- Create: `tests/editor-routing.test.ts`

**Step 1: Write the failing test**

Create `tests/editor-routing.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildEditorPath } from '../lib/editor-routing'

describe('editor routing', () => {
  it('builds editor path from UUID', () => {
    const path = buildEditorPath('123e4567-e89b-12d3-a456-426614174000')
    expect(path).toBe('/dashboard/editor/123e4567-e89b-12d3-a456-426614174000')
  })
})
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/editor-routing.test.ts
```
Expected: FAIL (module does not exist).

**Step 3: Commit**
```bash
git add tests/editor-routing.test.ts
git commit -m "test: add editor routing UUID expectation"
```

---

### Task 2: Implement editor routing helper

**Files:**
- Create: `lib/editor-routing.ts`

**Step 1: Implement helper**

Create `lib/editor-routing.ts`:
```ts
export function buildEditorPath(id: string): string {
  return `/dashboard/editor/${id}`
}
```

**Step 2: Run tests (green)**

Run:
```bash
npm test -- tests/editor-routing.test.ts
```
Expected: PASS.

**Step 3: Commit**
```bash
git add lib/editor-routing.ts
git commit -m "feat: add editor routing helper"
```

---

### Task 3: Update dashboard links to use UUID

**Files:**
- Modify: `app/routes/dashboard/index.tsx`

**Step 1: Use editor routing helper**

Add import:
```ts
import { buildEditorPath } from '../../../lib/editor-routing'
```

Update any links or navigate calls that currently use `post.slug` to use `post.id`, for example:
```ts
<Link to={buildEditorPath(post.id)}>
```

Update `navigate` call after create:
```ts
navigate({ to: '/dashboard/editor/$slug', params: { slug: result.id } })
```

**Step 2: Run tests**

Run:
```bash
npm test
```
Expected: PASS.

**Step 3: Commit**
```bash
git add app/routes/dashboard/index.tsx
git commit -m "refactor: use UUID for editor navigation"
```

---

### Task 4: Optional normalization when opened by slug (if desired)

**Files:**
- Modify: `app/routes/dashboard/editor.$slug.tsx`

**Step 1: Add redirect to UUID (optional)**

After loading `post`, if route param is not a UUID, navigate to UUID:
```ts
const param = Route.useParams().slug
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
if (!isUuid && post?.id) {
  navigate({ to: '/dashboard/editor/$slug', params: { slug: post.id }, replace: true })
}
```

**Step 2: Manual verification**
- Open editor via old slug URL, confirm it redirects to UUID URL.

**Step 3: Commit (if implemented)**
```bash
git add app/routes/dashboard/editor.$slug.tsx
git commit -m "feat: normalize editor URL to UUID"
```

---

Plan complete.
