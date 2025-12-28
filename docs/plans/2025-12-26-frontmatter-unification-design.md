# Frontmatter Unification (A1) Design

Date: 2025-12-26

## Summary
Unify frontmatter handling across the app by routing all read/write paths through the shared frontmatter utilities while keeping the existing flat `key: value` format. The goal is consistent data flow, fewer corruption cases, and safer round-trips without adding new dependencies.

## Goals
- Use `parseFrontmatter` + `serializeFrontmatter` for all editor and server paths.
- Preserve unknown/custom frontmatter keys on save.
- Normalize known keys to canonical snake_case and remove legacy aliases.
- Improve serialization robustness (quoting/escaping) to handle colons, quotes, arrays, and multi-line values.

## Non-goals
- No YAML parser dependency.
- No format migration beyond normalization on save.
- No broad UI redesign.

## Design
### Read Path (Editors)
- Replace ad-hoc `split(':')` parsing in post/page editors with `parseFrontmatter`.
- Store two values in state:
  - `rawFrontmatter`: the parsed frontmatter object (for unknown keys).
  - `frontmatter`: editor UI fields derived from `rawFrontmatter` with alias normalization.
- Body content comes from `parseFrontmatter(...).body`.

### Write Path (Editors)
- Build a canonical frontmatter object from editor UI fields.
- Merge `rawFrontmatter` with canonical fields to preserve unknown keys.
- Remove legacy alias keys (e.g., `Meta Title`, `Primary Keyword`, `URL Slug`) to avoid duplication.
- Normalize `secondary_keywords` to a string array when possible.
- Serialize with improved `serializeFrontmatter` and prepend to body.

### Serialization Rules
- Quote string values containing `:` or newlines; escape quotes.
- Serialize arrays as `["a", "b"]` when items need quoting.
- Preserve booleans and numbers.

## Testing
- Unit tests for `parseFrontmatter`/`serializeFrontmatter`:
  - colons, quotes, multi-line strings
  - array parsing/serialization
  - booleans/numbers
- Editor-level test: edit one field, ensure unknown keys remain and aliases removed.

## Rollout
- No migration step required; normalization happens on next save.
- Safe fallback: if parsing fails, treat content as body with empty frontmatter.

## Risks
- Slight formatting changes in frontmatter on save due to normalization and quoting.

## Acceptance Criteria
- Editors and server functions produce identical frontmatter for the same content.
- Saving a post/page preserves unknown keys and removes aliases.
- No data loss for values containing colons or quotes.
