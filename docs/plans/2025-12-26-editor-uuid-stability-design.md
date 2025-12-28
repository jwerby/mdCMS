# Editor UUID Stability Design

Date: 2025-12-26

## Summary
Make editor routes stable by using immutable post UUIDs (`article_id`) for all CMS editor navigation. Public URLs continue to use slugs derived from `url_slug`.

## Goals
- Editor URLs remain stable even if `url_slug` changes.
- Dashboard and creation flows always navigate via UUID.
- Preserve existing slug-based public URLs.

## Non-goals
- No change to public blog routing.
- No server API changes to accept UUID for all mutations.

## Design
### Canonical Editor URL
- Use `/dashboard/editor/<article_id>` as the canonical editor route.
- Existing loader already accepts UUIDs and falls back to slug lookup.

### Navigation Changes
- Dashboard list links (edit/title clicks) use `post.id` instead of `post.slug`.
- Create flow navigates to `/dashboard/editor/<id>` using `createPost` result.
- Editor does not redirect to slug on save/publish; it stays on UUID route.

### Optional Hardening
- If editor is opened with a slug, resolve the post, then navigate to `/dashboard/editor/<id>` to normalize the URL. (Only if needed.)

## Affected Files
- `app/routes/dashboard/index.tsx`
- `app/routes/dashboard/editor.$slug.tsx`

## Testing
- Manual: create post, confirm editor URL uses UUID.
- Manual: change `url_slug`, confirm editor URL remains stable.
- Optional unit/integration: ensure dashboard edit link uses UUID.

## Risks
- None to public routes; editor route already supports UUIDs.
