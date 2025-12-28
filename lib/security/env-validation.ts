/**
 * Environment variable validation
 * Fails fast if required secrets are missing or malformed
 */

interface EnvConfig {
  GEMINI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  NODE_ENV?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate that required environment variables are present and properly formatted
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const env = process.env as EnvConfig

  // Check for at least one AI provider
  if (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) {
    errors.push('At least one AI API key required: GEMINI_API_KEY or ANTHROPIC_API_KEY')
  }

  // Validate Gemini API key format if present
  if (env.GEMINI_API_KEY) {
    if (env.GEMINI_API_KEY.length < 20) {
      errors.push('GEMINI_API_KEY appears to be invalid (too short)')
    }
    if (env.GEMINI_API_KEY.includes(' ')) {
      errors.push('GEMINI_API_KEY contains spaces - check for copy/paste errors')
    }
  }

  // Validate Anthropic API key format if present
  if (env.ANTHROPIC_API_KEY) {
    if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      warnings.push('ANTHROPIC_API_KEY should start with "sk-ant-"')
    }
    if (env.ANTHROPIC_API_KEY.length < 40) {
      errors.push('ANTHROPIC_API_KEY appears to be invalid (too short)')
    }
  }

  // Check Better Auth configuration
  if (!env.BETTER_AUTH_SECRET) {
    errors.push('BETTER_AUTH_SECRET is required for authentication')
  } else if (env.BETTER_AUTH_SECRET.length < 32) {
    warnings.push('BETTER_AUTH_SECRET should be at least 32 characters for security')
  }

  if (!env.BETTER_AUTH_URL) {
    warnings.push('BETTER_AUTH_URL not set - defaulting to http://localhost:3113')
  }

  // Check for common mistakes
  if (env.GEMINI_API_KEY === 'your-api-key-here' ||
      env.ANTHROPIC_API_KEY === 'your-api-key-here') {
    errors.push('API keys contain placeholder values - please set real keys')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate environment and throw if invalid
 * Call this during server startup
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment()

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[ENV WARNING] ${warning}`)
  }

  // Throw on errors
  if (!result.isValid) {
    console.error('[ENV ERROR] Environment validation failed:')
    for (const error of result.errors) {
      console.error(`  - ${error}`)
    }
    throw new Error(`Environment validation failed: ${result.errors.join('; ')}`)
  }

  console.log('[ENV] Environment validation passed')
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Get a required environment variable or throw
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

/**
 * Get an optional environment variable with a default
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}
