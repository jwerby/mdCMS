/**
 * Model Configuration for Task-Based AI Selection
 *
 * Different tasks benefit from different model strengths:
 * - Research: Large context window for ingesting documents
 * - Outline: Strong logical structuring
 * - Draft: Best prose quality, least "AI-sounding"
 * - Evaluate: Large context to compare draft vs sources, fast for parallel judges
 * - Refine: Match the draft voice while fixing issues
 */

export type AITask = 'research' | 'outline' | 'draft' | 'evaluate' | 'refine'

export type AIProvider = 'gemini' | 'anthropic'

export interface ModelConfig {
  provider: AIProvider
  model: string
  description: string
}

/**
 * Task-to-model mapping
 *
 * Gemini 3 Flash: 1M context window, Pro-level intelligence, 3x faster - ideal for research & evaluation
 * Claude Sonnet 4.5: Best prose quality, follows complex instructions - ideal for writing
 */
export const TASK_MODEL_CONFIG: Record<AITask, ModelConfig> = {
  research: {
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    description: 'Large context (1M tokens) for document ingestion'
  },
  outline: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    description: 'Strong logical structuring'
  },
  draft: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    description: 'Best prose, least AI-sounding'
  },
  evaluate: {
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    description: 'Large context (1M tokens) for source comparison, 3x faster than 2.5 Pro'
  },
  refine: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    description: 'Match draft voice while fixing issues'
  }
}

/**
 * Get the recommended model configuration for a task
 */
export function getModelForTask(task: AITask): ModelConfig {
  return TASK_MODEL_CONFIG[task]
}

/**
 * Evaluation thresholds - articles fail if below these scores
 */
export const EVALUATION_THRESHOLDS = {
  accuracy: 9,      // Hard fail - factual errors are unacceptable
  uniqueness: 7,    // Fail if too "AI-sounding"
  readability: 6,   // Soft threshold
  grammar: 7,       // Should be clean
  optimization: 6,  // SEO basics must be met
  localAccuracy: 8, // Virginia Beach specific accuracy
}

/**
 * Get overall pass/fail based on individual scores
 */
export function evaluationPasses(scores: Record<string, number>): boolean {
  return (
    scores.accuracy >= EVALUATION_THRESHOLDS.accuracy &&
    scores.uniqueness >= EVALUATION_THRESHOLDS.uniqueness &&
    scores.readability >= EVALUATION_THRESHOLDS.readability &&
    scores.grammar >= EVALUATION_THRESHOLDS.grammar &&
    scores.optimization >= EVALUATION_THRESHOLDS.optimization &&
    (scores.localAccuracy === undefined || scores.localAccuracy >= EVALUATION_THRESHOLDS.localAccuracy)
  )
}
