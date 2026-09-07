"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import {
  isMobileDevice,
  isTabletDevice,
  shouldUseDesktopGeminiHeuristics,
  isMacOSDesktop,
} from "@/lib/device-utils"

export interface GeminiDetectorConfig {
  enabled: boolean
  onDetected?: (reason: string) => void
  onCleared?: () => void // Called when AI tool is no longer detected
  widthThreshold?: number // Default: 300px
  minWidthDifference?: number // Default: 300px
  maxWidthDifference?: number // Default: 450px
  /** When false, fullscreen is never required (quiz-level override, e.g. for testing/screenshots) */
  requireFullscreen?: boolean
  /** Synchronous pause (e.g. native file picker) — checked at detection time, not only when `enabled` toggles. */
  isDetectionPaused?: () => boolean
}

const MANUAL_CLEAR_COOLDOWN_MS = 8000

export interface GeminiDetectorState {
  isDetected: boolean // Current detection state
  checkForSidePanel: () => void // Manual check function
  clearDetection: () => void // Manually clear detection state (for manual dismissal)
  isFullscreen: boolean // Whether fullscreen is currently active (macOS & Windows)
  isFullscreenRequired: boolean // Whether fullscreen is required (macOS & Windows)
}

/**
 * Hook to detect Gemini side-panel and other AI browser tools
 * Implements detection methods:
 * 1. Layout Detection (Windows): Monitors resize events for sudden width changes (320-400px)
 * 2. Side-Panel Fingerprint (Windows): Compares outerWidth vs innerWidth to detect sidebars
 * 3. Focus/Visibility Detection (macOS): Monitors document.hasFocus() and visibility API for pop-up windows
 * 4. Fullscreen Enforcement (macOS & Windows): Forces fullscreen mode to block floating overlays and side-panels
 */
export function useGeminiDetector({
  enabled,
  onDetected,
  onCleared,
  widthThreshold = 300,
  minWidthDifference = 300,
  maxWidthDifference = 450,
  requireFullscreen,
  isDetectionPaused,
}: GeminiDetectorConfig) {
  const lastWidthRef = useRef<number>(typeof window !== "undefined" ? window.innerWidth : 0)
  const isDetectionPausedRef = useRef(isDetectionPaused)

  useEffect(() => {
    isDetectionPausedRef.current = isDetectionPaused
  }, [isDetectionPaused])

  const detectionAllowed = useCallback(() => {
    if (!enabled) return false
    if (!shouldUseDesktopGeminiHeuristics()) return false
    return isDetectionPausedRef.current?.() !== true
  }, [enabled])
  const detectionTimeoutRef = useRef<NodeJS.Timeout>()
  const isDesktopGeminiEligibleRef = useRef<boolean>(false)
  const hasDetectedRef = useRef<boolean>(false) // Track if we've already detected and notified
  const lastDetectionTimeRef = useRef<number>(0) // Track last detection time for debouncing
  const debounceDelay = 5000 // Only detect once every 5 seconds max
  const [isDetected, setIsDetected] = useState(false)
  const orientationGraceUntilRef = useRef<number>(0)
  
  // macOS desktop-only refs (excludes iPhone/iPad)
  const isMacOSDesktopRef = useRef<boolean>(false)
  const lastFocusStateRef = useRef<boolean>(true)
  const focusLossStartTimeRef = useRef<number>(0)
  const focusRegainedTimeRef = useRef<number>(0) // Track when focus was regained
  const lastClearedTimeRef = useRef<number>(0) // Track when detection was last cleared (cooldown period)
  const fullscreenEnforcedRef = useRef<boolean>(false)
  const focusCheckIntervalRef = useRef<NodeJS.Timeout>()
  const macDetectionTimeoutRef = useRef<NodeJS.Timeout>()
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const isInClearCooldown = useCallback(() => {
    if (lastClearedTimeRef.current <= 0) return false
    return Date.now() - lastClearedTimeRef.current < MANUAL_CLEAR_COOLDOWN_MS
  }, [])

  const refreshDeviceEligibility = useCallback(() => {
    if (typeof window === "undefined") return
    isDesktopGeminiEligibleRef.current = shouldUseDesktopGeminiHeuristics()
    isMacOSDesktopRef.current = isMacOSDesktop()
    lastFocusStateRef.current = document.hasFocus()

    console.log("[Gemini Detector] Device eligibility:", {
      desktopGeminiHeuristics: isDesktopGeminiEligibleRef.current,
      isMacOSDesktop: isMacOSDesktopRef.current,
      isMobile: isMobileDevice(),
      isTablet: isTabletDevice(),
      innerWidth: window.innerWidth,
      hasFocus: lastFocusStateRef.current,
      enabled,
    })
  }, [enabled])

  // Phones/tablets: skip resize/focus/side-panel heuristics entirely
  useEffect(() => {
    if (typeof window === "undefined") return
    refreshDeviceEligibility()

    const handleDeviceContextChange = () => {
      // Orientation and pinch-zoom resize the viewport — grace period avoids false positives on tablets
      if (isTabletDevice() || isMobileDevice()) {
        orientationGraceUntilRef.current = Date.now() + 4000
      }
      refreshDeviceEligibility()
    }

    window.addEventListener("resize", handleDeviceContextChange)
    window.addEventListener("orientationchange", handleDeviceContextChange)

    return () => {
      window.removeEventListener("resize", handleDeviceContextChange)
      window.removeEventListener("orientationchange", handleDeviceContextChange)
    }
  }, [enabled, refreshDeviceEligibility])

  // Method 1: Layout Detection Hack - Monitor resize events for sudden width changes
  const handleResize = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined") return
    if (!isDesktopGeminiEligibleRef.current) return
    if (Date.now() < orientationGraceUntilRef.current) return
    if (isInClearCooldown()) return

    // Debounce: prevent rapid-fire detections
    const now = Date.now()
    if (now - lastDetectionTimeRef.current < debounceDelay) {
      return
    }

    const currentWidth = window.innerWidth
    const widthDifference = lastWidthRef.current - currentWidth

    // Chrome's Gemini panel is typically ~320px to ~400px wide
    // Detect sudden width reduction in this range
    if (
      widthDifference >= minWidthDifference &&
      widthDifference <= maxWidthDifference &&
      isDesktopGeminiEligibleRef.current &&
      !hasDetectedRef.current // Only detect once until condition clears
    ) {
        // Check debounce
        if (now - lastDetectionTimeRef.current >= debounceDelay) {
          const reason = `Layout change detected: viewport width decreased by ${widthDifference}px (likely Gemini side-panel opened)`
          
          hasDetectedRef.current = true
          lastDetectionTimeRef.current = now
          setIsDetected(true)
          
          console.log("[Gemini Detector] 🚨 POP-UP DETECTED - Windows resize detection triggered:", reason, {
            widthDifference,
            timestamp: new Date().toISOString()
          })
          
          if (onDetected) {
            onDetected(reason)
          }
        }
    }

    // Reset detection flag if width returns to normal (side-panel closed)
    // Width difference is small (normal state) or negative (width increased, panel closed)
    if (hasDetectedRef.current && widthDifference <= 50) {
      // Verify with side-panel fingerprint check to ensure panel is actually closed
      const sidebarWidth = window.outerWidth - window.innerWidth
      if (sidebarWidth <= widthThreshold) {
        console.log("[Gemini Detector] ✅ POP-UP DISMISSED/CLOSED - Windows: Side-panel closed, clearing detection", {
          sidebarWidth,
          widthThreshold,
          timestamp: new Date().toISOString()
        })
        
        hasDetectedRef.current = false
        setIsDetected(false)
        if (onCleared) {
          console.log("[Gemini Detector] Calling onCleared callback - pop-up dismissed")
          onCleared()
        }
      }
    }

    lastWidthRef.current = currentWidth
  }, [detectionAllowed, onDetected, onCleared, minWidthDifference, maxWidthDifference, debounceDelay, isInClearCooldown])

  // Method 2: Side-Panel Fingerprint Detector - Compare outerWidth vs innerWidth
  const checkForSidePanel = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined") return
    if (!isDesktopGeminiEligibleRef.current) return
    if (Date.now() < orientationGraceUntilRef.current) return
    if (isInClearCooldown()) return

    // Calculate the "missing" width
    // window.outerWidth is the whole window, window.innerWidth is the website area
    const sidebarWidth = window.outerWidth - window.innerWidth

    if (sidebarWidth > widthThreshold) {
      // Only notify if we haven't already detected (debounce handled by time check)
      if (!hasDetectedRef.current) {
        const now = Date.now()
        // Only detect if enough time has passed since last detection
        if (now - lastDetectionTimeRef.current >= debounceDelay) {
          const reason = `Side-panel detected: ${sidebarWidth}px difference between outer and inner width (likely Gemini or browser AI tool)`
          
          hasDetectedRef.current = true
          lastDetectionTimeRef.current = now
          setIsDetected(true)
          
          console.log("[Gemini Detector] 🚨 POP-UP DETECTED - Windows side-panel detection triggered:", reason, {
            sidebarWidth,
            widthThreshold,
            timestamp: new Date().toISOString()
          })
          
          if (onDetected) {
            onDetected(reason)
          }
        }
      }
    } else {
      // Reset detection flag if side-panel is closed (no debounce for clearing)
      if (hasDetectedRef.current && sidebarWidth <= widthThreshold) {
        console.log("[Gemini Detector] ✅ POP-UP DISMISSED/CLOSED - Windows: Side-panel closed, clearing detection", {
          sidebarWidth,
          widthThreshold,
          timestamp: new Date().toISOString()
        })
        
        hasDetectedRef.current = false
        setIsDetected(false)
        if (onCleared) {
          console.log("[Gemini Detector] Calling onCleared callback - pop-up dismissed")
          onCleared()
        }
      }
    }
  }, [detectionAllowed, onDetected, onCleared, widthThreshold, debounceDelay, isInClearCooldown])

  // Method 3: macOS Focus/Visibility Detection - Use window.onblur and window.onfocus events
  // Action: Pop-up Opens → window.onblur → Show Warning / Log Strike
  // Action: Pop-up Active → document.hasFocus() === false → Keep Warning Visible
  // Action: Pop-up Closes → window.onfocus → Dismiss Warning Automatically
  
  // Handle window blur event (pop-up opens)
  const handleWindowBlur = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined" || !isDesktopGeminiEligibleRef.current) return
    if (isInClearCooldown()) return
    
    // Only detect if tab is still visible (not hidden)
    const isVisible = !document.hidden
    
    // CRITICAL: Only detect if not already detected (prevents multiple detections)
    if (isVisible && !hasDetectedRef.current) {
      // Debounce: prevent rapid re-detection
      const now = Date.now()
      const timeSinceLastDetection = lastDetectionTimeRef.current > 0 
        ? now - lastDetectionTimeRef.current 
        : debounceDelay + 1
      
      const timeSinceLastClear = lastClearedTimeRef.current > 0
        ? now - lastClearedTimeRef.current
        : debounceDelay + 1
      
      // Require at least debounceDelay since last detection
      // BUT: After manual dismissal (lastClearedTime is recent), only require debounceDelay
      // After automatic detection, require 2 seconds to prevent rapid cycling
      const isRecentManualDismissal = lastClearedTimeRef.current > 0 && 
        (now - lastClearedTimeRef.current) < 5000 // Within 5 seconds of manual dismissal
      
      const minDelay = isRecentManualDismissal 
        ? debounceDelay // Allow faster re-detection after manual dismissal
        : Math.max(debounceDelay, 2000) // Require 2 seconds for automatic detections
      
      const actualDelay = Math.max(timeSinceLastDetection, timeSinceLastClear)
      
      console.log("[Gemini Detector] window.onblur - checking if should detect:", {
        isVisible,
        hasDetected: hasDetectedRef.current,
        timeSinceLastDetection,
        timeSinceLastClear,
        isRecentManualDismissal: lastClearedTimeRef.current > 0 && (now - lastClearedTimeRef.current) < 5000,
        minDelay,
        actualDelay,
        willDetect: actualDelay >= minDelay
      })
      
      if (actualDelay >= minDelay) {
        const reason = `${isMacOSDesktopRef.current ? "macOS" : "Windows"}: Window blur detected (likely AI assistant overlay opened)`
        
        // CRITICAL: Set flag BEFORE calling onDetected to prevent race conditions
        hasDetectedRef.current = true
        lastDetectionTimeRef.current = now
        setIsDetected(true)
        
        console.log("[Gemini Detector] 🚨 POP-UP DETECTED (window.onblur) - macOS:", reason, {
          timestamp: new Date().toISOString(),
          timeSinceLastDetection,
          timeSinceLastClear,
          actualDelay
        })
        
        if (onDetected) {
          onDetected(reason)
        }
      } else {
        console.log("[Gemini Detector] window.onblur ignored - debounce active", {
          timeSinceLastDetection,
          timeSinceLastClear,
          requiredDelay: minDelay,
          actualDelay
        })
      }
    } else {
      if (hasDetectedRef.current) {
        console.log("[Gemini Detector] window.onblur ignored - already detected", {
          hasDetected: hasDetectedRef.current,
          isVisible
        })
      }
    }
  }, [detectionAllowed, onDetected, debounceDelay, isInClearCooldown])
  
  // Handle window focus event (pop-up closes)
  const handleWindowFocus = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined" || !isDesktopGeminiEligibleRef.current) return
    
    console.log("[Gemini Detector] window.onfocus event fired", {
      hasDetected: hasDetectedRef.current,
      timestamp: new Date().toISOString()
    })
    
    // Only clear if we had previously detected
    if (hasDetectedRef.current) {
      // Verify focus is actually regained
      const hasFocus = document.hasFocus()
      const isVisible = !document.hidden
      
      console.log("[Gemini Detector] Checking focus state after window.onfocus:", {
        hasFocus,
        isVisible,
        hasDetected: hasDetectedRef.current
      })
      
      if (hasFocus && isVisible) {
        console.log("[Gemini Detector] ✅ POP-UP DISMISSED/CLOSED (window.onfocus) - macOS: Focus regained, clearing detection", {
          timestamp: new Date().toISOString()
        })
        
        hasDetectedRef.current = false
        focusLossStartTimeRef.current = 0
        focusRegainedTimeRef.current = 0
        lastClearedTimeRef.current = Date.now()
        setIsDetected(false)
        
        // Call onCleared immediately when focus is regained
        if (onCleared) {
          console.log("[Gemini Detector] Calling onCleared callback - pop-up dismissed")
          onCleared()
        }
      } else {
        console.log("[Gemini Detector] window.onfocus fired but focus not regained yet", {
          hasFocus,
          isVisible
        })
      }
    }
  }, [detectionAllowed, onCleared])
  
  // Monitor active state: Keep warning visible while document.hasFocus() === false
  // Also detect dismissal when focus is regained (PRIMARY method since window.onfocus doesn't fire reliably)
  const checkActiveState = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined" || !isDesktopGeminiEligibleRef.current) return
    
    const hasFocus = document.hasFocus()
    const isVisible = !document.hidden
    const now = Date.now()
    
    // If already detected, check if pop-up is still active or has been dismissed
    if (hasDetectedRef.current) {
      // CRITICAL: Check focus state - if focus is regained, pop-up is dismissed
      // Use a more lenient check: if focus is regained OR if it's been a while since detection
      const timeSinceDetection = lastDetectionTimeRef.current > 0 
        ? now - lastDetectionTimeRef.current 
        : 0
      
      // Check if focus is regained
      if (hasFocus && isVisible) {
        // CRITICAL: Focus regained - pop-up has been dismissed
        // This is the PRIMARY detection method since window.onfocus doesn't fire reliably on macOS
        console.log("[Gemini Detector] ✅ POP-UP DISMISSED/CLOSED (document.hasFocus check) - macOS: Focus regained, clearing detection", {
          timestamp: new Date().toISOString(),
          hasFocus,
          isVisible,
          wasDetected: hasDetectedRef.current,
          timeSinceDetection
        })
        
        // CRITICAL: Only clear once - prevent multiple calls
        hasDetectedRef.current = false
        focusLossStartTimeRef.current = 0
        focusRegainedTimeRef.current = 0
        lastClearedTimeRef.current = Date.now()
        setIsDetected(false)
        
        // Call onCleared immediately when focus is regained
        if (onCleared) {
          console.log("[Gemini Detector] Calling onCleared callback - pop-up dismissed (from checkActiveState)")
          onCleared()
        }
      } else if (!hasFocus && isVisible) {
        // Pop-up is still active - keep warning visible
        // BUT: Add timeout mechanism - if it's been more than 30 seconds, auto-dismiss (safety mechanism)
        if (timeSinceDetection > 30000) {
          console.warn("[Gemini Detector] ⚠️ Auto-dismissing after 30 seconds (safety mechanism) - focus may not be detected correctly", {
            timeSinceDetection,
            hasFocus,
            isVisible
          })
          
          hasDetectedRef.current = false
          lastClearedTimeRef.current = Date.now()
          setIsDetected(false)
          
          if (onCleared) {
            console.log("[Gemini Detector] Calling onCleared callback - auto-dismissed after timeout")
            onCleared()
          }
        } else {
          // Log periodically to confirm it's still active
          if (now % 2000 < 100) { // Log every 2 seconds
            console.log("[Gemini Detector] Pop-up still active - document.hasFocus() === false", {
              hasFocus,
              isVisible,
              timeSinceDetection,
              timestamp: new Date().toISOString()
            })
          }
        }
      } else {
        // Tab is hidden - log for debugging
        console.log("[Gemini Detector] Tab hidden - cannot determine pop-up state", {
          hasFocus,
          isVisible
        })
      }
    } else if (!hasFocus && isVisible && !hasDetectedRef.current && !isInClearCooldown()) {
      // Floating/minimized AI overlays (no viewport width change) still steal focus
      if (focusLossStartTimeRef.current === 0) {
        focusLossStartTimeRef.current = now
      } else if (now - focusLossStartTimeRef.current >= 2000) {
        if (now - lastDetectionTimeRef.current >= debounceDelay) {
          const reason = `${isMacOSDesktopRef.current ? "macOS" : "Windows"}: Sustained focus loss detected (likely minimized AI assistant)`
          hasDetectedRef.current = true
          lastDetectionTimeRef.current = now
          setIsDetected(true)
          if (onDetected) onDetected(reason)
        }
      }
    } else if (hasFocus) {
      focusLossStartTimeRef.current = 0
    }
  }, [detectionAllowed, onCleared, onDetected, debounceDelay, isInClearCooldown])

  // Method 4: Fullscreen Enforcement - Force fullscreen to block overlays (macOS and Windows)
  // This prevents Gemini pop-ups/side-panels from overlaying the assessment
  // NOTE: Disabled on mobile devices - mobile can't run multiple tabs/Gemini concurrently
  const enforceFullscreen = useCallback(async () => {
    if (!enabled || typeof window === "undefined" || isMobileDevice() || isTabletDevice()) return

    try {
      const element = document.documentElement
      
      // Check if already in fullscreen
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )

      if (isFullscreen) {
        fullscreenEnforcedRef.current = true
        return
      }

      // Request fullscreen (try all browser prefixes)
      if (element.requestFullscreen) {
        await element.requestFullscreen()
        fullscreenEnforcedRef.current = true
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
        fullscreenEnforcedRef.current = true
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen()
        fullscreenEnforcedRef.current = true
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
        fullscreenEnforcedRef.current = true
      }
    } catch (error) {
      // Fullscreen request failed (user denied or not supported)
      // This is okay - we'll continue with other detection methods
      console.warn("[Gemini Detector] Fullscreen request failed:", error)
    }
  }, [enabled])

  const effectiveEnabled =
    enabled && (typeof window === "undefined" || shouldUseDesktopGeminiHeuristics())

  // Set up resize listener for layout detection (desktop only)
  useEffect(() => {
    if (!effectiveEnabled || typeof window === "undefined") return

    lastWidthRef.current = window.innerWidth
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [effectiveEnabled, handleResize])

  // Set up periodic side-panel fingerprint check (desktop only)
  useEffect(() => {
    if (!effectiveEnabled || typeof window === "undefined") return

    checkForSidePanel()

    const interval = setInterval(() => {
      checkForSidePanel()
    }, 1500)

    return () => {
      clearInterval(interval)
    }
  }, [effectiveEnabled, checkForSidePanel])

  // macOS/Windows desktop: focus/visibility monitoring
  useEffect(() => {
    if (!effectiveEnabled || typeof window === "undefined") return

    window.addEventListener("blur", handleWindowBlur)
    window.addEventListener("focus", handleWindowFocus)

    focusCheckIntervalRef.current = setInterval(() => {
      checkActiveState()
    }, 100)

    return () => {
      if (focusCheckIntervalRef.current) {
        clearInterval(focusCheckIntervalRef.current)
      }
      window.removeEventListener("blur", handleWindowBlur)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [effectiveEnabled, handleWindowBlur, handleWindowFocus, checkActiveState])

  // Fullscreen Enforcement: Enforce fullscreen on macOS and Windows to block overlays/side-panels
  useEffect(() => {
    if (!effectiveEnabled || typeof window === "undefined") return

    // Attempt to enter fullscreen when enabled (only once)
    enforceFullscreen()

    // Block ESC key from exiting fullscreen
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block ESC key when in fullscreen to prevent exit
      if (e.key === "Escape" || e.keyCode === 27) {
        const isFullscreen = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
        
        if (isFullscreen && effectiveEnabled) {
          e.preventDefault()
          e.stopPropagation()
          // Immediately re-enter fullscreen if they try to exit
          enforceFullscreen()
        }
      }
    }

    // Monitor fullscreen state changes
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )

      fullscreenEnforcedRef.current = isCurrentlyFullscreen
      setIsFullscreen(isCurrentlyFullscreen)

      // CRITICAL: If user exits fullscreen, immediately try to re-enter (no delay)
      // This prevents students from using browser menus to exit fullscreen
      if (!isCurrentlyFullscreen && effectiveEnabled) {
        if (macDetectionTimeoutRef.current) {
          clearTimeout(macDetectionTimeoutRef.current)
        }
        // Use minimal delay (100ms) to allow browser to process exit, then immediately re-enter
        macDetectionTimeoutRef.current = setTimeout(() => {
          enforceFullscreen()
        }, 100) // Reduced from 1000ms to 100ms for immediate re-entry
      }
    }

    // Initial fullscreen check
    const checkFullscreen = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
      fullscreenEnforcedRef.current = isCurrentlyFullscreen
    }

    // Check immediately
    checkFullscreen()

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)
    document.addEventListener("keydown", handleKeyDown, true) // Use capture phase to catch ESC early

    return () => {
      if (macDetectionTimeoutRef.current) {
        clearTimeout(macDetectionTimeoutRef.current)
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [effectiveEnabled, enforceFullscreen])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current)
      }
      if (focusCheckIntervalRef.current) {
        clearInterval(focusCheckIntervalRef.current)
      }
      if (macDetectionTimeoutRef.current) {
        clearTimeout(macDetectionTimeoutRef.current)
      }
    }
  }, [])

  // Function to manually clear detection state (for manual dismissal)
  const clearDetection = useCallback(() => {
    const now = Date.now()
    console.log("[Gemini Detector] Manually clearing detection state", {
      wasDetected: hasDetectedRef.current,
      timestamp: new Date().toISOString()
    })
    
    hasDetectedRef.current = false
    focusLossStartTimeRef.current = 0
    focusRegainedTimeRef.current = 0
    lastClearedTimeRef.current = now
    lastDetectionTimeRef.current = now
    setIsDetected(false)
  }, [])

  return {
    isDetected,
    checkForSidePanel,
    clearDetection,
    isFullscreen: isFullscreen,
    // Only require fullscreen when quiz explicitly has require_fullscreen=true.
    // When false or undefined (default), never require - allows testing/screenshots without interruption.
    isFullscreenRequired: requireFullscreen === true ? effectiveEnabled : false,
  }
}
