# Content Guidance Pipeline

This project uses a shared guidance layer to keep AI-generated content consistent and
high quality across all flows (write, rewrite, research, SEO generation, refine,
apply fixes, and feedback updates).

## What the Guidance Layer Does

The guidance block is injected into AI prompts and enforces:

- Natural keyword variation (avoid repeated exact phrases)
- Scannability (short paragraphs, bold key terms)
- Anchor text for URLs (no raw links)
- Clear, audience-aligned CTA

## Hyperlocal Enrichment

When a region is detected, the guidance layer adds local entity suggestions and
local acronyms. Detection is hybrid:

1. **Curated map** in `context/geo-entities.json` (preferred)
2. **Inference** from topic/content/keywords (fallback)

If no region is detected, the pipeline skips local enrichment.

### Example `geo-entities.json`

```json
{
  "virginia beach": {
    "synonyms": ["vb", "hampton roads", "tidewater"],
    "entities": ["Hampton Roads", "Virginia Beach HIVE", "757 Angels"],
    "acronyms": ["BPOL", "SCC", "SWaM"],
    "programs": ["Virginia Beach Economic Development"]
  }
}
```

## Deterministic Post-Processing

After AI generation, content is cleaned with deterministic rules:

- Raw URLs → descriptive anchor text
- Meta descriptions avoid copying the first sentence
- Length and truncation guards

## Where It’s Implemented

- Guidance building: `lib/content-guidance.ts`
- Post-processing: `lib/content-postprocess.ts`
- Prompt builders: `server/functions/ai/*`

## How to Extend

- Add new regions to `context/geo-entities.json`
- Add additional guidance rules in `buildGuidanceBlock`
- Add new post-processing rules in `content-postprocess.ts`
