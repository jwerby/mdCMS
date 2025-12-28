'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  type AccessibilityPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  clearPreferences,
  getAccessibilityCSSVars,
  getAccessibilityDataAttrs,
  fontScales,
  lineHeights,
} from '../../lib/accessibility'

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences
  updatePreferences: (updates: Partial<AccessibilityPreferences>) => void
  resetPreferences: () => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}

interface AccessibilityProviderProps {
  children: React.ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences)
  const [isOpen, setIsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = loadPreferences()
    setPreferences(saved)
    setIsHydrated(true)
  }, [])

  // Apply preferences to document
  useEffect(() => {
    if (!isHydrated || typeof document === 'undefined') return

    const html = document.documentElement

    // Apply CSS custom properties
    const cssVars = getAccessibilityCSSVars(preferences)
    Object.entries(cssVars).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })

    // Apply data attributes for CSS selectors
    const dataAttrs = getAccessibilityDataAttrs(preferences)
    Object.entries(dataAttrs).forEach(([key, value]) => {
      html.setAttribute(key, value)
    })

    // Save to localStorage
    savePreferences(preferences)
  }, [preferences, isHydrated])

  // Keyboard shortcut: Alt+A to toggle widget
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const updatePreferences = useCallback((updates: Partial<AccessibilityPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }))
  }, [])

  const resetPreferences = useCallback(() => {
    clearPreferences()
    setPreferences(defaultPreferences)
  }, [])

  const value = useMemo(() => ({
    preferences,
    updatePreferences,
    resetPreferences,
    isOpen,
    setIsOpen,
  }), [preferences, updatePreferences, resetPreferences, isOpen])

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  )
}
