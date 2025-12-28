'use client'

import React, { useEffect, useRef } from 'react'
import { Accessibility, X, RotateCcw, Type, AlignJustify, Contrast, Eye } from 'lucide-react'
import { useAccessibility } from './AccessibilityProvider'
import type { FontSize, LineSpacing } from '../../lib/accessibility'

const fontSizeOptions: { value: FontSize; label: string; scale: string }[] = [
  { value: 'default', label: 'A', scale: '1x' },
  { value: 'large', label: 'A', scale: '1.15x' },
  { value: 'xl', label: 'A', scale: '1.3x' },
  { value: 'xxl', label: 'A', scale: '1.5x' },
]

const lineSpacingOptions: { value: LineSpacing; label: string }[] = [
  { value: 'normal', label: '1' },
  { value: 'relaxed', label: '1.75' },
  { value: 'loose', label: '2' },
]

export function AccessibilityWidget() {
  const { preferences, updatePreferences, resetPreferences, isOpen, setIsOpen } = useAccessibility()
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Focus trap and click-outside handling
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, setIsOpen])

  // Focus first focusable element when panel opens
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [isOpen])

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Accessibility settings"
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all flex items-center justify-center group"
      >
        <Accessibility className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div
          ref={panelRef}
          id="accessibility-panel"
          role="dialog"
          aria-label="Accessibility settings"
          aria-modal="true"
          className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-right"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Accessibility className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-800">Accessibility</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close accessibility settings"
              className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-6">
            {/* Font Size */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Type className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Font Size</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {fontSizeOptions.map((option, idx) => (
                  <button
                    key={option.value}
                    onClick={() => updatePreferences({ fontSize: option.value })}
                    aria-pressed={preferences.fontSize === option.value}
                    className={`py-2 px-3 rounded-lg border-2 transition-all text-center ${
                      preferences.fontSize === option.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className={`block font-semibold ${idx === 0 ? 'text-sm' : idx === 1 ? 'text-base' : idx === 2 ? 'text-lg' : 'text-xl'}`}>
                      {option.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{option.scale}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Line Spacing */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlignJustify className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Line Spacing</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {lineSpacingOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updatePreferences({ lineSpacing: option.value })}
                    aria-pressed={preferences.lineSpacing === option.value}
                    className={`py-2 px-3 rounded-lg border-2 transition-all text-center ${
                      preferences.lineSpacing === option.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className="block font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              {/* High Contrast */}
              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Contrast className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">High Contrast</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={preferences.contrast === 'high'}
                    onChange={(e) => updatePreferences({ contrast: e.target.checked ? 'high' : 'normal' })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
              </label>

              {/* Dyslexia Font */}
              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Dyslexia-Friendly Font</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={preferences.dyslexiaFont}
                    onChange={(e) => updatePreferences({ dyslexiaFont: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
              </label>

              {/* Reduce Motion */}
              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">Reduce Motion</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={preferences.reducedMotion === 'on'}
                    onChange={(e) => updatePreferences({ reducedMotion: e.target.checked ? 'on' : 'system' })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
              </label>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetPreferences}
              className="w-full py-2.5 px-4 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>

          {/* Footer hint */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] font-mono">Alt + A</kbd> to toggle
            </p>
          </div>
        </div>
      )}
    </>
  )
}
