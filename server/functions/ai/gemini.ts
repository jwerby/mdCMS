import { GoogleGenAI } from '@google/genai'
import type { AIGenerateOptions } from './index'

const apiKey = process.env.GEMINI_API_KEY

export async function generateWithGemini(options: AIGenerateOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const ai = new GoogleGenAI({ apiKey })

  const systemInstruction = options.systemPrompt ?? 'You are an expert SEO content writer.'

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: options.prompt,
    config: {
      maxOutputTokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.7,
      systemInstruction,
    },
  })

  const text = response.text

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}
