/**
 * Delta-based storage for version history
 * Stores first version as full content, subsequent versions as diffs
 * Significantly reduces storage for large documents with small changes
 */

import * as Diff from 'diff'

/**
 * A patch representing changes between two versions
 */
export interface DeltaPatch {
  /** Unified diff format */
  patch: string
  /** Original content length (for validation) */
  originalLength: number
  /** Result content length (for validation) */
  resultLength: number
}

/**
 * Version entry with optional delta storage
 * - First version (base) has full content
 * - Subsequent versions have delta patches
 */
export interface DeltaVersionEntry {
  id: string
  timestamp: number
  type: 'post' | 'page'
  slug: string
  summary?: string
  /** Full content (only for base version) */
  content?: string
  /** Delta patch from previous version (for non-base versions) */
  delta?: DeltaPatch
  /** Whether this is the base version */
  isBase: boolean
}

/**
 * Create a delta patch between two versions
 */
export function createDelta(oldContent: string, newContent: string): DeltaPatch {
  const patch = Diff.createPatch('content', oldContent, newContent, '', '', {
    context: 3 // Context lines for accurate patching
  })

  return {
    patch,
    originalLength: oldContent.length,
    resultLength: newContent.length
  }
}

/**
 * Apply a delta patch to content to get the new version
 */
export function applyDelta(content: string, delta: DeltaPatch): string | null {
  try {
    // Validate original length
    if (content.length !== delta.originalLength) {
      console.warn('Delta application warning: content length mismatch', {
        expected: delta.originalLength,
        actual: content.length
      })
    }

    const result = Diff.applyPatch(content, delta.patch)

    if (result === false) {
      console.error('Delta application failed: patch could not be applied')
      return null
    }

    // Validate result length
    if (result.length !== delta.resultLength) {
      console.warn('Delta application warning: result length mismatch', {
        expected: delta.resultLength,
        actual: result.length
      })
    }

    return result
  } catch (error) {
    console.error('Delta application error:', error)
    return null
  }
}

/**
 * Reconstruct full content from a chain of delta versions
 * Walks from base version forward, applying each delta
 */
export function reconstructContent(
  versions: DeltaVersionEntry[],
  targetId: string
): string | null {
  // Find the target version index
  const targetIndex = versions.findIndex(v => v.id === targetId)
  if (targetIndex === -1) {
    return null
  }

  // Find the base version (newest base at or before target)
  let baseIndex = -1
  for (let i = targetIndex; i < versions.length; i++) {
    if (versions[i].isBase && versions[i].content) {
      baseIndex = i
      break
    }
  }

  if (baseIndex === -1) {
    console.error('No base version found for reconstruction')
    return null
  }

  // Start with base content
  let content = versions[baseIndex].content!

  // Apply deltas from base to target (backwards in array, since newest is first)
  // versions[baseIndex] -> versions[baseIndex-1] -> ... -> versions[targetIndex]
  for (let i = baseIndex - 1; i >= targetIndex; i--) {
    const version = versions[i]
    if (!version.delta) {
      console.error('Missing delta for non-base version:', version.id)
      return null
    }

    const newContent = applyDelta(content, version.delta)
    if (newContent === null) {
      console.error('Failed to apply delta for version:', version.id)
      return null
    }
    content = newContent
  }

  return content
}

/**
 * Convert legacy full-content versions to delta format
 */
export function convertToDeltaFormat(
  legacyVersions: Array<{
    id: string
    timestamp: number
    content: string
    type: 'post' | 'page'
    slug: string
    summary?: string
  }>
): DeltaVersionEntry[] {
  if (legacyVersions.length === 0) {
    return []
  }

  const deltaVersions: DeltaVersionEntry[] = []

  // Process from oldest to newest (reverse order since newest is first)
  const reversed = [...legacyVersions].reverse()

  for (let i = 0; i < reversed.length; i++) {
    const version = reversed[i]

    if (i === 0) {
      // First (oldest) version is the base
      deltaVersions.push({
        id: version.id,
        timestamp: version.timestamp,
        type: version.type,
        slug: version.slug,
        summary: version.summary,
        content: version.content,
        isBase: true
      })
    } else {
      // Subsequent versions store delta from previous
      const prevVersion = reversed[i - 1]
      const delta = createDelta(prevVersion.content, version.content)

      deltaVersions.push({
        id: version.id,
        timestamp: version.timestamp,
        type: version.type,
        slug: version.slug,
        summary: version.summary,
        delta,
        isBase: false
      })
    }
  }

  // Reverse back so newest is first
  return deltaVersions.reverse()
}

/**
 * Check if delta storage provides space savings
 * Returns the compression ratio (< 1 means savings)
 */
export function calculateCompressionRatio(
  fullContentVersions: Array<{ content: string }>,
  deltaVersions: DeltaVersionEntry[]
): { fullSize: number; deltaSize: number; ratio: number; savings: string } {
  const fullSize = fullContentVersions.reduce(
    (acc, v) => acc + v.content.length,
    0
  )

  let deltaSize = 0
  for (const v of deltaVersions) {
    if (v.content) {
      deltaSize += v.content.length
    }
    if (v.delta) {
      deltaSize += v.delta.patch.length
    }
  }

  const ratio = deltaSize / fullSize
  const savingsPercent = ((1 - ratio) * 100).toFixed(1)

  return {
    fullSize,
    deltaSize,
    ratio,
    savings: `${savingsPercent}%`
  }
}

/**
 * Compact history by creating a new base version periodically
 * This prevents delta chains from getting too long
 */
export function compactHistory(
  versions: DeltaVersionEntry[],
  maxChainLength: number = 5
): DeltaVersionEntry[] {
  if (versions.length <= 1) {
    return versions
  }

  const result: DeltaVersionEntry[] = []
  let chainLength = 0

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]

    if (version.isBase) {
      // Keep base versions as-is
      result.push(version)
      chainLength = 0
    } else if (chainLength >= maxChainLength) {
      // Convert to base version after max chain length
      const content = reconstructContent(versions, version.id)
      if (content) {
        result.push({
          ...version,
          content,
          delta: undefined,
          isBase: true
        })
        chainLength = 0
      } else {
        // Fallback: keep as delta if reconstruction fails
        result.push(version)
        chainLength++
      }
    } else {
      result.push(version)
      chainLength++
    }
  }

  return result
}
