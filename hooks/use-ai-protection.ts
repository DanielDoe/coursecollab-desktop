"use client"

import { useEffect } from 'react'

/**
 * Hook to add comprehensive AI protection to quiz pages
 * 
 * Implements multiple protection layers:
 * 1. Blocks AI extension access to DOM
 * 2. Prevents text selection
 * 3. Monitors for AI extension injection
 * 4. Adds runtime protection
 */
export function useAIProtection(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    // Block AI extensions from accessing content
    const blockAIExtensions = () => {
      // Remove AI extension overlays
      const aiSelectors = [
        '[data-gemini]',
        '[data-ai-assistant]',
        '[data-copilot]',
        '[data-chatgpt]',
        '.gemini-sidebar',
        '.ai-assistant-panel',
        '[id*="gemini"]',
        '[id*="copilot"]',
        '[class*="gemini"]',
        '[class*="copilot"]',
      ]

      aiSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach(el => {
            // Only remove if it's trying to access quiz content
            const quizContent = document.querySelector('[data-ai-protected="true"]')
            if (quizContent && (quizContent.contains(el) || el.contains(quizContent))) {
              el.remove()
            }
          })
        } catch (e) {
          // Ignore errors
        }
      })
    }

    // Prevent text selection globally on quiz pages
    const preventSelection = () => {
      const style = document.createElement('style')
      style.id = 'ai-protection-styles'
      style.textContent = `
        [data-ai-protected="true"],
        [data-ai-protected="true"] * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        
        [data-ai-protected="true"]::selection,
        [data-ai-protected="true"] *::selection {
          background: transparent !important;
        }
        
        [data-ai-protected="true"]::-moz-selection,
        [data-ai-protected="true"] *::-moz-selection {
          background: transparent !important;
        }
      `
      
      // Remove existing style if present
      const existing = document.getElementById('ai-protection-styles')
      if (existing) {
        existing.remove()
      }
      
      document.head.appendChild(style)
    }

    // Monitor for AI extension injection
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element
              
              // Check for AI extension markers
              const isAIExtension = 
                el.getAttribute('data-gemini') ||
                el.getAttribute('data-ai-assistant') ||
                el.getAttribute('data-copilot') ||
                el.classList.contains('gemini') ||
                el.classList.contains('ai-assistant') ||
                el.classList.contains('copilot') ||
                el.id?.includes('gemini') ||
                el.id?.includes('copilot')

              if (isAIExtension) {
                // Check if it's trying to access protected content
                const protectedContent = document.querySelector('[data-ai-protected="true"]')
                if (protectedContent) {
                  // Try to prevent access
                  try {
                    // Make content invisible to AI extensions
                    const allProtected = document.querySelectorAll('[data-ai-protected="true"]')
                    allProtected.forEach((element) => {
                      // Add additional protection
                      element.setAttribute('aria-hidden', 'true')
                      element.setAttribute('role', 'presentation')
                    })
                  } catch (e) {
                    // Ignore errors
                  }
                }
              }
            }
          })
        }
      })
    })

    // Prevent copy/paste/right-click globally
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('[data-ai-protected="true"]')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as Element
      if (target.closest('[data-ai-protected="true"]')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as Element
      if (target.closest('[data-ai-protected="true"]')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as Element
      if (target.closest('[data-ai-protected="true"]')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    const handleSelectStart = (e: Event) => {
      const target = e.target as Element
      if (target.closest('[data-ai-protected="true"]')) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Initialize protection
    preventSelection()
    blockAIExtensions()

    // Set up observers and listeners
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-gemini', 'data-ai-assistant', 'data-copilot', 'class', 'id']
    })

    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('copy', handleCopy, true)
    document.addEventListener('cut', handleCut, true)
    document.addEventListener('paste', handlePaste, true)
    document.addEventListener('selectstart', handleSelectStart, true)

    // Periodic cleanup
    const interval = setInterval(() => {
      blockAIExtensions()
    }, 1000)

    return () => {
      observer.disconnect()
      clearInterval(interval)
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('copy', handleCopy, true)
      document.removeEventListener('cut', handleCut, true)
      document.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('selectstart', handleSelectStart, true)
      
      const style = document.getElementById('ai-protection-styles')
      if (style) {
        style.remove()
      }
    }
  }, [enabled])
}
