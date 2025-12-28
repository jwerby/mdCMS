import Anthropic from '@anthropic-ai/sdk'
import type { AIGenerateOptions } from './index'

const apiKey = process.env.ANTHROPIC_API_KEY

export async function generateWithAnthropic(options: AIGenerateOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const client = new Anthropic({
    apiKey,
  })

  const systemPrompt = options.systemPrompt ?? 'You are an expert SEO content writer.'

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: options.maxTokens ?? 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: options.prompt,
      },
    ],
  })

  // Extract text from content blocks
  const textContent = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  if (!textContent) {
    throw new Error('Anthropic returned empty response')
  }

  return textContent
}
