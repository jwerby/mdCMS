import { generateWithGemini } from './gemini'
import { generateWithAnthropic } from './anthropic'
import { loadContextFiles } from './prompts'

export interface AIGenerateOptions {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface AIResponse {
  content: string
  provider: 'gemini' | 'anthropic'
  tokensUsed?: number
}

/**
 * Generate content using Gemini as primary, Anthropic as fallback
 */
export async function generate(options: AIGenerateOptions): Promise<AIResponse> {
  // Load context files to enrich the prompt
  const context = await loadContextFiles()

  const enrichedPrompt = context
    ? `${options.prompt}\n\n---\nContext:\n${context}`
    : options.prompt

  const enrichedOptions = { ...options, prompt: enrichedPrompt }

  // Try Gemini first
  try {
    const geminiResult = await generateWithGemini(enrichedOptions)
    return {
      content: geminiResult,
      provider: 'gemini'
    }
  } catch (geminiError) {
    console.warn('Gemini failed, falling back to Anthropic:', geminiError)

    // Fallback to Anthropic
    try {
      const anthropicResult = await generateWithAnthropic(enrichedOptions)
      return {
        content: anthropicResult,
        provider: 'anthropic'
      }
    } catch (anthropicError) {
      console.error('Both AI providers failed:', anthropicError)
      throw new Error('All AI providers failed. Please check your API keys.')
    }
  }
}

/**
 * Generate with a specific provider (no fallback)
 */
export async function generateWithProvider(
  provider: 'gemini' | 'anthropic',
  options: AIGenerateOptions
): Promise<AIResponse> {
  const context = await loadContextFiles()
  const enrichedPrompt = context
    ? `${options.prompt}\n\n---\nContext:\n${context}`
    : options.prompt

  const enrichedOptions = { ...options, prompt: enrichedPrompt }

  if (provider === 'gemini') {
    const result = await generateWithGemini(enrichedOptions)
    return { content: result, provider: 'gemini' }
  } else {
    const result = await generateWithAnthropic(enrichedOptions)
    return { content: result, provider: 'anthropic' }
  }
}

export { loadContextFiles } from './prompts'
