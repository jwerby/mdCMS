# Content Guidance Pipeline Design

## Goal
Improve AI content generation quality across all current and future posts by adding a reusable guidance layer, hybrid hyperlocal enrichment, and deterministic post-processing.

## Background
Current AI prompts vary by flow (write/research/optimize/rewrite/update) and quality rules are inconsistently enforced. The pipeline should:
- Reduce keyword stuffing
- Improve hyperlocal authority when geographic intent exists
- Improve UX (anchor text, scannability, CTA)
- Keep non-local content broad without over-localization

## High-Level Architecture
Introduce a **Content Guidance Layer** that:
1) Builds a **ContentProfile** from inputs (topic, keywords, draft, outline, feedback).
2) Generates a **GuidanceBlock** injected into all AI prompts.
3) Applies deterministic **Post-Processing** to enforce non-negotiable rules.

## Components

### 1) ContentProfile (new)
Derived from available inputs:
- `topic`, `primaryKeyword`, `secondaryKeywords`
- `contentType` (how-to, list, editorial, case study)
- `geo` (detected region or null)
- `audience` and `intent` (heuristic)
- `riskFlags` (keyword stuffing, no conclusion, long paragraphs, etc.)
- `suggestedEntities` (local orgs, programs, acronyms)

### 2) Geo Detection (hybrid)
**Primary:** `context/geo-entities.json` (curated map of regions → entities/rules).  
**Fallback:** inference from topic/title/body (city/state/country patterns).  
Behavior:
- If geo detected → inject local entity guidance + local acronym usage.
- If no geo → skip local enrichment and focus on general SEO/UX rules.

### 3) GuidanceBlock (prompt injection)
Injected into all AI prompt flows (write/rewrite/research/optimize/refine/update/generateSEO).
Includes:
- Keyword variation rule (avoid repeated exact phrase)
- Scannability (short paragraphs, bold key terms)
- CTA requirement
- Anchor text requirement
- Hyperlocal rules (only if geo detected)

### 4) Deterministic Post-Processing
Applied after AI output, per-flow configurable:
- Convert raw URLs to anchor text
- Meta description cleanup (length, no truncation, not verbatim first sentence)
- Slug normalization (no mid-word truncation)
- Heading hygiene (single H1)
- Optional keyword de-duplication if exact phrase is overused

## Data Flow
1) User triggers AI action.
2) Build ContentProfile from inputs (topic/keywords/draft/feedback).
3) Generate GuidanceBlock.
4) Append GuidanceBlock to AI prompt.
5) Run AI generation.
6) Post-process output (per-flow rules).
7) Save content + metadata.

## Testing Strategy
Unit tests:
- Geo detection: curated hit, inferred hit, and no-geo fallback
- Risk flags: keyword stuffing detection, long paragraph detection
- Anchorizer: raw URL → descriptive anchor text
- Meta description cleaner: no truncation, length compliance

Integration tests:
- Each AI flow includes GuidanceBlock in prompt
- Post-processor runs for write/rewrite/update/generateSEO flows

## Success Criteria
- Reduced keyword stuffing in generated content
- Local content mentions relevant entities without forced repetition
- Meta descriptions and slugs no longer truncated mid-word
- Improved readability and stronger CTAs across all posts

