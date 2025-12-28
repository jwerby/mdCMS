import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY

// Models for different use cases
const MODELS = {
  // Fast, efficient - good for inline images
  flash: 'gemini-2.0-flash-exp-image-generation',
  // High quality with better text rendering - good for featured images
  pro: 'gemini-2.0-flash-exp-image-generation',
  // Vision model for image analysis
  vision: 'gemini-2.0-flash',
} as const

export type ImageModel = keyof typeof MODELS
export type ImageStyle = 'photorealistic' | 'illustration' | 'digital-art' | 'minimalist' | 'abstract'
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | '1200x630'

export interface GenerateImageOptions {
  prompt: string
  model?: ImageModel
  style?: ImageStyle
  size?: ImageSize
  brandContext?: {
    primaryColor?: string
    secondaryColor?: string
    mood?: string
  }
}

export interface GeneratedImage {
  base64: string
  mimeType: string
  prompt: string
  model: string
}

/**
 * Build an enhanced prompt with style and brand context
 */
function buildImagePrompt(options: GenerateImageOptions): string {
  const { prompt, style = 'photorealistic', size = '1024x1024', brandContext } = options

  const styleDescriptions: Record<ImageStyle, string> = {
    photorealistic: 'photorealistic, high quality photograph, professional lighting',
    illustration: 'modern illustration style, clean lines, vibrant colors',
    'digital-art': 'digital art, contemporary design, polished finish',
    minimalist: 'minimalist design, clean, simple, lots of white space',
    abstract: 'abstract artistic interpretation, creative, visually striking',
  }

  const sizeDescriptions: Record<ImageSize, string> = {
    '1024x1024': 'square format',
    '1536x1024': 'landscape wide format',
    '1024x1536': 'portrait tall format',
    '1200x630': 'social media landscape format (1200x630)',
  }

  // CRITICAL: Start with no-text instruction - AI models follow early instructions better
  let enhancedPrompt = `CRITICAL REQUIREMENT: This image must contain absolutely NO text, NO words, NO letters, NO numbers, NO titles, NO captions, NO watermarks, NO logos with text. Generate a purely visual image only.

Create an image: ${prompt}

Style: ${styleDescriptions[style]}
Format: ${sizeDescriptions[size]}`

  if (brandContext) {
    enhancedPrompt += `\n\nBrand guidelines:`
    if (brandContext.primaryColor) {
      enhancedPrompt += `\n- Primary color accent: ${brandContext.primaryColor}`
    }
    if (brandContext.secondaryColor) {
      enhancedPrompt += `\n- Secondary color: ${brandContext.secondaryColor}`
    }
    if (brandContext.mood) {
      enhancedPrompt += `\n- Overall mood: ${brandContext.mood}`
    }
  }

  enhancedPrompt += `

REMINDER: Do NOT render any text or words in the image. The image must be purely visual.`

  return enhancedPrompt
}

/**
 * Generate an image using Gemini's image generation models
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const ai = new GoogleGenAI({ apiKey })
  const modelKey = options.model ?? 'flash'
  const modelId = MODELS[modelKey]

  const enhancedPrompt = buildImagePrompt(options)

  const response = await ai.models.generateContent({
    model: modelId,
    contents: enhancedPrompt,
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  // Extract image from response
  const candidates = response.candidates
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidates in image generation response')
  }

  const firstCandidate = candidates[0]
  if (!firstCandidate) {
    throw new Error('No first candidate in image generation response')
  }

  const content = firstCandidate.content
  if (!content || !content.parts || content.parts.length === 0) {
    throw new Error('No parts in image generation response')
  }

  const parts = content.parts

  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data as string,
        mimeType: part.inlineData.mimeType ?? 'image/png',
        prompt: enhancedPrompt,
        model: modelId,
      }
    }
  }

  throw new Error('No image data in response')
}

/**
 * Extract visual concepts from a title without including the literal text
 * This prevents the AI from rendering the title as text on the image
 */
function extractVisualConcepts(title: string, description?: string, category?: string): string {
  // Extract key themes from title without using the literal text
  const concepts: string[] = []

  // Common topic patterns to visual concepts
  const topicMappings: Record<string, string> = {
    'business': 'entrepreneurship, commerce, professional setting',
    'start a business': 'entrepreneur launching a new venture, startup atmosphere',
    'virginia beach': 'coastal city, beach town, ocean views',
    'guide': 'educational, informative, helpful resource',
    'how to': 'step-by-step process, instructional',
    'tips': 'advice, helpful suggestions',
    'best': 'top quality, excellent options',
    'restaurant': 'dining, food, culinary',
    'food': 'cuisine, meals, ingredients',
    'event': 'gathering, celebration, community',
    'art': 'creative, artistic, gallery',
    'music': 'musical instruments, performance, concert',
    'beach': 'sandy shore, ocean waves, coastal',
    'ocean': 'sea, water, marine',
    'family': 'parents and children, togetherness',
    'outdoor': 'nature, outside activities',
    'real estate': 'homes, properties, buildings',
    'travel': 'journey, exploration, adventure',
  }

  const lowerTitle = title.toLowerCase()
  for (const [keyword, concept] of Object.entries(topicMappings)) {
    if (lowerTitle.includes(keyword)) {
      concepts.push(concept)
    }
  }

  // Add description concepts if available
  if (description) {
    concepts.push(description)
  }

  // Add category as a theme
  if (category) {
    concepts.push(`${category} theme`)
  }

  // Fallback if no concepts matched
  if (concepts.length === 0) {
    concepts.push('professional, modern, visually appealing')
  }

  return concepts.join(', ')
}

/**
 * Generate a featured image for a blog post
 */
export async function generateFeaturedImage(
  title: string,
  description?: string,
  category?: string
): Promise<GeneratedImage> {
  // Extract visual concepts WITHOUT using the literal title text
  // This prevents the AI from rendering text on the image
  const visualConcepts = extractVisualConcepts(title, description, category)

  const prompt = `A compelling featured image for a blog article.

Visual themes to convey: ${visualConcepts}

The image should be visually striking, professional, and evoke these themes without any text overlay.
Make it suitable as a hero image at the top of an article.
Focus on imagery, scenery, objects, or abstract visuals - no text or typography.`

  return generateImage({
    prompt,
    model: 'pro',
    style: 'digital-art',
    size: '1200x630',
    brandContext: {
      primaryColor: 'indigo/purple',
      mood: 'professional, modern, inspiring',
    },
  })
}

/**
 * Generate an inline image based on a text selection or context
 */
export async function generateInlineImage(
  context: string,
  style: ImageStyle = 'illustration'
): Promise<GeneratedImage> {
  // Extract visual concepts from the context to avoid text rendering
  const visualConcepts = extractVisualConcepts(context)

  const prompt = `An image that visually represents: ${visualConcepts}

This will be used as an inline image within a blog article to help visualize a concept.
Focus on visual elements, scenes, objects, or abstract representations - no text or typography.`

  return generateImage({
    prompt,
    model: 'flash',
    style,
    size: '1024x1024',
  })
}

/**
 * Generate multiple image options for user selection
 */
export async function generateImageOptions(
  prompt: string,
  count: number = 3
): Promise<GeneratedImage[]> {
  // Extract visual concepts to prevent text rendering
  const visualConcepts = extractVisualConcepts(prompt)

  const enhancedPrompt = `Visual representation of: ${visualConcepts}

Focus on imagery, scenery, and visual elements - no text or typography.`

  const styles: ImageStyle[] = ['photorealistic', 'illustration', 'digital-art']
  const selectedStyles = styles.slice(0, count)

  const promises = selectedStyles.map((style) =>
    generateImage({
      prompt: enhancedPrompt,
      model: 'flash',
      style,
      size: '1024x1024',
    })
  )

  return Promise.all(promises)
}

/**
 * Image analysis result from vision model
 */
export interface ImageAnalysis {
  altText: string
  seoFilename: string
  description: string
  keywords: string[]
}

/**
 * Analyze an image using Gemini vision to generate alt text, SEO filename, and description
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context?: string
): Promise<ImageAnalysis> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const ai = new GoogleGenAI({ apiKey })

  const contextHint = context
    ? `\n\nAdditional context about this image: ${context}`
    : ''

  const prompt = `Analyze this image and provide the following in JSON format:

1. "altText": A concise, descriptive alt text for accessibility (max 125 characters). Describe what's in the image for someone who cannot see it. Do not start with "Image of" or "Picture of".

2. "seoFilename": A short SEO-friendly filename (max 50 characters, lowercase, hyphens instead of spaces, no file extension). Use descriptive keywords that would help this image rank in search.

3. "description": A brief description of the image content (1-2 sentences).

4. "keywords": An array of 3-5 relevant keywords for this image.${contextHint}

Respond ONLY with valid JSON, no markdown or explanation.`

  const response = await ai.models.generateContent({
    model: MODELS.vision,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  })

  const text = response.text?.trim() || ''

  // Parse JSON response, handling potential markdown code blocks
  let jsonStr = text
  if (text.startsWith('```')) {
    jsonStr = text.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
  }

  try {
    const result = JSON.parse(jsonStr)
    return {
      altText: String(result.altText || '').substring(0, 125),
      seoFilename: String(result.seoFilename || 'image')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50),
      description: String(result.description || ''),
      keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 5) : [],
    }
  } catch {
    // Fallback if JSON parsing fails
    return {
      altText: context?.substring(0, 125) || 'Image',
      seoFilename: 'image',
      description: '',
      keywords: [],
    }
  }
}

/**
 * Generate alt text for an AI-generated image based on the generation context
 */
export async function generateAltTextFromContext(
  title: string,
  description?: string,
  category?: string
): Promise<string> {
  if (!apiKey) {
    // Fallback: use title as alt text
    return title.substring(0, 125)
  }

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `Generate a concise, descriptive alt text (max 125 characters) for a blog featured image.

Blog post title: "${title}"
${description ? `Description: ${description}` : ''}
${category ? `Category: ${category}` : ''}

The alt text should:
- Describe what someone would likely see in a professional featured image for this article
- Be helpful for screen reader users
- Not start with "Image of" or "Picture of"
- Be specific and descriptive

Respond with ONLY the alt text, nothing else.`

  try {
    const response = await ai.models.generateContent({
      model: MODELS.vision,
      contents: prompt,
    })

    const altText = response.text?.trim() || title
    return altText.substring(0, 125)
  } catch {
    return title.substring(0, 125)
  }
}
