# Feedback-Driven Article Update Design

Date: 2025-12-27
Owner: Codex (implementation pending)

## Goal
Add an inline “Update with Feedback” panel in the editor so editors can supply guidance (e.g., “add a stronger conclusion,” “tighten section 3”) and generate a revised draft that they can review and accept via the existing diff workflow.

## UX Summary
- Collapsible panel positioned above the markdown editor (not in SEO).
- Textarea for feedback, helper text, and a primary “Generate update” button.
- Button disabled unless feedback length is sufficient and content exists.
- On success, show DiffModal with original vs. updated content.
- Accept applies changes to editor state; no auto-save.

## Data Flow
1. User enters feedback and clicks “Generate update.”
2. Client calls new server function `runUpdateWithFeedback` with:
   - Full article (frontmatter + body)
   - Feedback text
   - Optional frontmatter metadata (if needed for prompting)
3. Server builds a prompt that:
   - Preserves voice, structure, facts, and frontmatter.
   - Applies ONLY the feedback.
   - Returns full markdown with frontmatter.
4. Server normalizes response:
   - Strip AI preamble
   - Preserve/merge frontmatter; keep `article_id` stable
   - If no frontmatter returned, reattach original
5. Client opens DiffModal with original + updated content.

## Error Handling
- Failures show toast and keep editor state unchanged.
- Empty or too-short responses are rejected with a warning toast.
- Small-change responses still allowed, but with a “small changes detected” note.

## Integrity Requirements
- `article_id` remains stable.
- Existing frontmatter keys preserved unless explicitly changed.
- If missing frontmatter, original frontmatter is reattached.

## Testing Plan
- Unit tests for server function:
  - Preserves `article_id` and required frontmatter.
  - Reattaches original frontmatter when response lacks it.
- UI test:
  - Disabled button when feedback empty.
  - Clicking “Generate update” triggers server call and opens DiffModal on success.

