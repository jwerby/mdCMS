/**
 * Accessibility preferences management
 * Handles user preferences for font size, contrast, line spacing, etc.
 * Persists to localStorage and respects system preferences
 */

export type FontSize = 'default' | 'large' | 'xl' | 'xxl'
export type ContrastMode = 'normal' | 'high'
export type LineSpacing = 'normal' | 'relaxed' | 'loose'
export type ReducedMotion = 'system' | 'on' | 'off'

export interface AccessibilityPreferences {
  fontSize: FontSize
  contrast: ContrastMode
  lineSpacing: LineSpacing
  dyslexiaFont: boolean
  reducedMotion: ReducedMotion
}

const STORAGE_KEY = 'mdcms_accessibility'

export const defaultPreferences: AccessibilityPreferences = {
  fontSize: 'default',
  contrast: 'normal',
  lineSpacing: 'normal',
  dyslexiaFont: false,
  reducedMotion: 'system',
}

// Font scale multipliers
export const fontScales: Record<FontSize, number> = {
  default: 1,
  large: 1.15,
  xl: 1.3,
  xxl: 1.5,
}

// Line height values
export const lineHeights: Record<LineSpacing, number> = {
  normal: 1.6,
  relaxed: 1.75,
  loose: 2.0,
}

/**
 * Detect system preference for reduced motion
 */
export function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Detect system preference for high contrast
 */
export function getSystemHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: more)').matches
}

/**
 * Get default preferences based on system settings
 */
export function getSystemDefaults(): Partial<AccessibilityPreferences> {
  const defaults: Partial<AccessibilityPreferences> = {}

  if (getSystemHighContrast()) {
    defaults.contrast = 'high'
  }

  return defaults
}

/**
 * Load preferences from localStorage
 */
export function loadPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') {
    return { ...defaultPreferences }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure all fields exist
      return { ...defaultPreferences, ...getSystemDefaults(), ...parsed }
    }
  } catch {
    // Invalid JSON or storage error
  }

  return { ...defaultPreferences, ...getSystemDefaults() }
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(prefs: AccessibilityPreferences): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage quota exceeded or disabled
  }
}

/**
 * Clear saved preferences
 */
export function clearPreferences(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage error
  }
}

/**
 * Check if reduced motion should be applied
 */
export function shouldReduceMotion(pref: ReducedMotion): boolean {
  if (pref === 'on') return true
  if (pref === 'off') return false
  // 'system' - follow OS preference
  return getSystemReducedMotion()
}

/**
 * Generate CSS custom property values from preferences
 */
export function getAccessibilityCSSVars(prefs: AccessibilityPreferences): Record<string, string> {
  return {
    '--a11y-font-scale': String(fontScales[prefs.fontSize]),
    '--a11y-line-height': String(lineHeights[prefs.lineSpacing]),
  }
}

/**
 * Generate data attributes for CSS selectors
 */
export function getAccessibilityDataAttrs(prefs: AccessibilityPreferences): Record<string, string> {
  return {
    'data-contrast': prefs.contrast,
    'data-dyslexia-font': String(prefs.dyslexiaFont),
    'data-reduced-motion': String(shouldReduceMotion(prefs.reducedMotion)),
    'data-font-size': prefs.fontSize,
    'data-line-spacing': prefs.lineSpacing,
  }
}
