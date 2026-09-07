"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

interface UseBrowserAIBlockerOptions {
  enabled?: boolean
  assessmentType?: string
}

/**
 * Minimal, effective hook to block browser AI tools (Gemini, Copilot, etc.) during assessments
 * 
 * Applies only to: quizzes, homework, midterms, finals
 * Excludes: CodeBench routes
 * 
 * Protections:
 * 1. Disable text selection (breaks Gemini's usefulness)
 * 2. Disable context menu (blocks AI right-click flows)
 * 3. Block copy/paste (prevents content extraction)
 */
export function useBrowserAIBlocker({ enabled = true, assessmentType }: UseBrowserAIBlockerOptions = {}) {
  const pathname = usePathname()
  const isActiveRef = useRef(false)

  useEffect(() => {
    // Check if we're on a CodeBench route - exclude it
    if (pathname?.includes('/codebench')) {
      return
    }

    // Determine if assessment mode should be active (only quizzes, homework, midterms, finals)
    const isAssessmentMode = enabled && (
      assessmentType === 'quiz' ||
      assessmentType === 'homework' ||
      assessmentType === 'mid_semester' ||
      assessmentType === 'midsem' ||
      assessmentType === 'final' ||
      assessmentType === 'finals' ||
      pathname?.includes('/quiz/') ||
      pathname?.includes('/homework/') ||
      pathname?.includes('/mid-semester-exams/') ||
      pathname?.includes('/final-exams/') ||
      pathname?.includes('/take-quiz/')
    )

    if (!isAssessmentMode) {
      isActiveRef.current = false
      return
    }

    isActiveRef.current = true

    // Helper to check if target is an editable element (input, textarea, code editor)
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      
      const tagName = target.tagName.toLowerCase()
      const isInput = tagName === 'input' || tagName === 'textarea'
      const isContentEditable = target.isContentEditable
      const isMonacoEditor = target.closest('.monaco-editor') !== null || 
                            target.closest('[data-monaco-editor]') !== null ||
                            target.classList.contains('monaco-editor') ||
                            target.hasAttribute('data-monaco-editor')
      
      return isInput || isContentEditable || isMonacoEditor
    }

    // ✅ 1. Disable text selection (this breaks Gemini's usefulness)
    const style = document.createElement('style')
    style.id = 'browser-ai-blocker-styles'
    style.textContent = `
      .assessment-mode {
        user-select: none !important;
        -webkit-user-select: none !important;
        -ms-user-select: none !important;
        -moz-user-select: none !important;
      }
      
      /* Allow selection in code editors and input fields */
      .assessment-mode textarea,
      .assessment-mode input[type="text"],
      .assessment-mode input[type="number"],
      .assessment-mode input[type="email"],
      .assessment-mode input[type="password"],
      .assessment-mode [contenteditable="true"],
      .assessment-mode .monaco-editor,
      .assessment-mode .monaco-editor *,
      .assessment-mode [data-monaco-editor],
      .assessment-mode [data-monaco-editor] * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -ms-user-select: text !important;
        -moz-user-select: text !important;
      }
    `
    document.head.appendChild(style)
    document.body.classList.add('assessment-mode')

    // ✅ 2. Disable context menu (blocks AI right-click flows)
    const handleContextMenu = (e: MouseEvent) => {
      if (!isEditableElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // ✅ 3. Block copy / paste (prevents content extraction)
    const handleCopy = (e: ClipboardEvent) => {
      if (!isEditableElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handleCut = (e: ClipboardEvent) => {
      if (!isEditableElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (!isEditableElement(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('copy', handleCopy, true)
    document.addEventListener('cut', handleCut, true)
    document.addEventListener('paste', handlePaste, true)

    // Cleanup
    return () => {
      // Remove assessment mode class
      document.body.classList.remove('assessment-mode')
      
      // Remove event listeners
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('copy', handleCopy, true)
      document.removeEventListener('cut', handleCut, true)
      document.removeEventListener('paste', handlePaste, true)
      
      // Remove styles
      const styleElement = document.getElementById('browser-ai-blocker-styles')
      if (styleElement) {
        styleElement.remove()
      }
      
      isActiveRef.current = false
    }
  }, [pathname, enabled, assessmentType])

  return {
    isActive: isActiveRef.current
  }
}
