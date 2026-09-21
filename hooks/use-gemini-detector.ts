"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import {
  isMobileDevice,
  isTabletDevice,
  shouldUseDesktopGeminiHeuristics,
  isMacOSDesktop,
  isPhoneOrTabletDevice,
} from "@/lib/device-utils"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"
import { isDocumentFullscreen, requestDocumentFullscreen, subscribeDocumentFullscreen } from "@/lib/document-fullscreen"

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
  /** Electron desktop: keep fullscreen lock only; skip browser AI side-panel heuristics. */
  skipBrowserAiHeuristics?: boolean
}

const MANUAL_CLEAR_COOLDOWN_MS = 8000
/** Focus must stay lost this long (tab still visible) before an AI overlay is suspected. Single blurs (Spotlight, notifications, OS menus) never fire. */
const SUSTAINED_FOCUS_LOSS_MS = 4000
/** Chrome-width delta must persist across this many consecutive 1.5s polls before firing. */
const PANEL_CONFIRM_POLLS = 2
/** Grace period after a page-zoom / devicePixelRatio change (zoom rescales innerWidth and would fake a panel). */
const ZOOM_CHANGE_GRACE_MS = 3000
/** Safety auto-clear for focus-based detections if focus events are unreliable. */
const FOCUS_DETECTION_SAFETY_CLEAR_MS = 30000

type DetectionSource = "panel" | "resize" | "focus"

export interface GeminiDetectorState {
  isDetected: boolean // Current detection state
  checkForSidePanel: () => void // Manual check function
  clearDetection: () => void // Manually clear detection state (for manual dismissal)
  isFullscreen: boolean // Whether fullscreen is currently active (macOS & Windows)
  isFullscreenRequired: boolean // Whether fullscreen is required (macOS & Windows)
}

/**
 * Hook to detect Gemini side-panel and other AI browser tools.
 *
 * Detection methods (all baseline-calibrated to avoid false positives):
 * 1. Side-Panel Fingerprint: outerWidth − innerWidth measured against a baseline captured when the
 *    assessment starts. Only a sustained *increase* over the baseline fires — normal browser chrome,
 *    scrollbars, page zoom, and DPI scaling are absorbed by the baseline.
 * 2. Layout Detection: sudden innerWidth drop (300–450px) corroborated by a matching chrome-width
 *    increase. Window snapping/un-maximizing shrinks outerWidth too, so it no longer fires.
 * 3. Sustained Focus Loss: focus lost for >= SUSTAINED_FOCUS_LOSS_MS while the tab stays visible.
 *    A single window blur (Spotlight, notification, OS menu) never counts.
 * 4. Fullscreen Enforcement: forces fullscreen to block floating overlays and side-panels.
 *
 * The Electron desktop shell has no browser tabs or AI side-panels, so browser-AI heuristics are
 * hard-disabled there regardless of props (kiosk mode + app-switch tracking cover desktop).
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
  skipBrowserAiHeuristics = false,
}: GeminiDetectorConfig) {
  const lastWidthRef = useRef<number>(typeof window !== "undefined" ? window.innerWidth : 0)
  const isDetectionPausedRef = useRef(isDetectionPaused)

  useEffect(() => {
    isDetectionPausedRef.current = isDetectionPaused
  }, [isDetectionPaused])

  const detectionAllowed = useCallback(() => {
    if (!enabled) return false
    if (skipBrowserAiHeuristics) return false
    // Electron shell: no browser AI side-panels exist — never run browser heuristics,
    // even if a consumer forgot to pass skipBrowserAiHeuristics.
    if (isDesktopElectronAssessmentClient()) return false
    if (!shouldUseDesktopGeminiHeuristics()) return false
    return isDetectionPausedRef.current?.() !== true
  }, [enabled, skipBrowserAiHeuristics])

  const isDesktopGeminiEligibleRef = useRef<boolean>(false)
  const hasDetectedRef = useRef<boolean>(false) // Track if we've already detected and notified
  const detectionSourceRef = useRef<DetectionSource | null>(null)
  const lastDetectionTimeRef = useRef<number>(0) // Track last detection time for debouncing
  const debounceDelay = 5000 // Only detect once every 5 seconds max
  const [isDetected, setIsDetected] = useState(false)
  const orientationGraceUntilRef = useRef<number>(0)

  // Baseline chrome width (outerWidth − innerWidth) captured while the window is "clean".
  // Detection keys off the *delta* from this baseline, not the raw value, so browser chrome,
  // zoom, and DPI scaling can't fake a side-panel.
  const baselineChromeWidthRef = useRef<number | null>(null)
  const panelStreakRef = useRef<number>(0)
  const lastDevicePixelRatioRef = useRef<number>(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  )

  // macOS desktop-only refs (excludes iPhone/iPad)
  const isMacOSDesktopRef = useRef<boolean>(false)
  const lastFocusStateRef = useRef<boolean>(true)
  const focusLossStartTimeRef = useRef<number>(0)
  const lastClearedTimeRef = useRef<number>(0) // Track when detection was last cleared (cooldown period)
  const fullscreenEnforcedRef = useRef<boolean>(false)
  const focusCheckIntervalRef = useRef<NodeJS.Timeout>()
  const macDetectionTimeoutRef = useRef<NodeJS.Timeout>()
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const isInClearCooldown = useCallback(() => {
    if (lastClearedTimeRef.current <= 0) return false
    return Date.now() - lastClearedTimeRef.current < MANUAL_CLEAR_COOLDOWN_MS
  }, [])

  const registerDetection = useCallback(
    (source: DetectionSource, reason: string) => {
      hasDetectedRef.current = true
      detectionSourceRef.current = source
      lastDetectionTimeRef.current = Date.now()
      setIsDetected(true)

      console.log(`[Gemini Detector] 🚨 DETECTED (${source}):`, reason, {
        timestamp: new Date().toISOString(),
      })

      onDetected?.(reason)
    },
    [onDetected],
  )

  const clearDetectionState = useCallback(
    (logReason: string) => {
      if (!hasDetectedRef.current) return
      hasDetectedRef.current = false
      detectionSourceRef.current = null
      focusLossStartTimeRef.current = 0
      panelStreakRef.current = 0
      lastClearedTimeRef.current = Date.now()
      setIsDetected(false)

      console.log(`[Gemini Detector] ✅ CLEARED: ${logReason}`, {
        timestamp: new Date().toISOString(),
      })

      onCleared?.()
    },
    [onCleared],
  )

  /**
   * Current chrome-width delta vs. baseline. Recalibrates the baseline downward whenever the
   * chrome shrinks (panel closed, zoom reduced) so it always tracks the "clean" state.
   */
  const readChromeDelta = useCallback((): number => {
    const chromeWidth = window.outerWidth - window.innerWidth
    // Page zoom < 100% or unusual window managers can make this non-positive — not meaningful.
    if (chromeWidth <= 0) {
      baselineChromeWidthRef.current = 0
      return 0
    }
    const baseline = baselineChromeWidthRef.current
    if (baseline === null || chromeWidth < baseline) {
      baselineChromeWidthRef.current = chromeWidth
      return 0
    }
    return chromeWidth - baseline
  }, [])

  /** Page zoom rescales innerWidth and would fake a side-panel — rebaseline and apply grace. */
  const didZoomChange = useCallback((): boolean => {
    const dpr = window.devicePixelRatio || 1
    if (dpr === lastDevicePixelRatioRef.current) return false
    lastDevicePixelRatioRef.current = dpr
    baselineChromeWidthRef.current = null
    panelStreakRef.current = 0
    orientationGraceUntilRef.current = Date.now() + ZOOM_CHANGE_GRACE_MS
    console.log("[Gemini Detector] Zoom/DPI change detected — rebaselining chrome width", { dpr })
    return true
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
      isElectronShell: isDesktopElectronAssessmentClient(),
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

  // Method 2: Layout Detection — sudden innerWidth drop corroborated by chrome-width increase.
  // A real side-panel shrinks innerWidth while outerWidth stays put; a window resize/snap
  // shrinks both, so the chrome delta stays ~0 and never fires.
  const handleResize = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined") return
    if (!isDesktopGeminiEligibleRef.current) return
    if (didZoomChange()) {
      lastWidthRef.current = window.innerWidth
      return
    }
    if (Date.now() < orientationGraceUntilRef.current) return
    if (isInClearCooldown()) {
      lastWidthRef.current = window.innerWidth
      return
    }

    const now = Date.now()
    const currentWidth = window.innerWidth
    const widthDifference = lastWidthRef.current - currentWidth
    const chromeDelta = readChromeDelta()

    // Chrome's Gemini panel is typically ~320px to ~400px wide
    if (
      widthDifference >= minWidthDifference &&
      widthDifference <= maxWidthDifference &&
      chromeDelta >= Math.min(minWidthDifference, widthThreshold) - 50 &&
      !hasDetectedRef.current &&
      now - lastDetectionTimeRef.current >= debounceDelay
    ) {
      registerDetection(
        "resize",
        `Layout change detected: content width dropped ${widthDifference}px while the window stayed the same size (likely a browser AI side-panel opened)`,
      )
    }

    // Reset detection if width returned to normal (side-panel closed)
    if (
      hasDetectedRef.current &&
      detectionSourceRef.current !== "focus" &&
      widthDifference <= 50 &&
      chromeDelta <= widthThreshold
    ) {
      clearDetectionState("side-panel closed (width restored)")
    }

    lastWidthRef.current = currentWidth
  }, [
    detectionAllowed,
    didZoomChange,
    readChromeDelta,
    registerDetection,
    clearDetectionState,
    minWidthDifference,
    maxWidthDifference,
    widthThreshold,
    isInClearCooldown,
  ])

  // Method 1: Side-Panel Fingerprint — chrome-width delta vs. baseline, confirmed across polls.
  const checkForSidePanel = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined") return
    if (!isDesktopGeminiEligibleRef.current) return
    if (didZoomChange()) return
    const now = Date.now()
    if (now < orientationGraceUntilRef.current) return
    if (isInClearCooldown()) return

    const chromeDelta = readChromeDelta()

    if (chromeDelta > widthThreshold) {
      panelStreakRef.current += 1
      if (
        panelStreakRef.current >= PANEL_CONFIRM_POLLS &&
        !hasDetectedRef.current &&
        now - lastDetectionTimeRef.current >= debounceDelay
      ) {
        registerDetection(
          "panel",
          `Side-panel detected: window content area shrank by ${chromeDelta}px vs. its starting size (likely Gemini or a browser AI tool)`,
        )
      }
    } else {
      panelStreakRef.current = 0
      // Clear panel/resize detections once the chrome returns to baseline.
      // Focus-based detections are cleared by focus regain, not by this check.
      if (hasDetectedRef.current && detectionSourceRef.current !== "focus") {
        clearDetectionState("side-panel closed (chrome width back to baseline)")
      }
    }
  }, [
    detectionAllowed,
    didZoomChange,
    readChromeDelta,
    registerDetection,
    clearDetectionState,
    widthThreshold,
    isInClearCooldown,
  ])

  // Method 3: Sustained Focus Loss — a single blur (Spotlight, notification, OS menu, password
  // manager) never fires. Focus must stay lost >= SUSTAINED_FOCUS_LOSS_MS while the tab remains
  // visible. Tab switches (document.hidden) are handled by the separate tab-switch tracker.
  const handleWindowBlur = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined" || !isDesktopGeminiEligibleRef.current) return
    if (isInClearCooldown()) return
    if (document.hidden) return

    if (!hasDetectedRef.current && focusLossStartTimeRef.current === 0) {
      focusLossStartTimeRef.current = Date.now()
      console.log("[Gemini Detector] window.onblur — starting sustained focus-loss timer", {
        timestamp: new Date().toISOString(),
      })
    }
  }, [detectionAllowed, isInClearCooldown])

  // Handle window focus event (overlay closes)
  const handleWindowFocus = useCallback(() => {
    if (typeof window === "undefined") return

    focusLossStartTimeRef.current = 0

    if (hasDetectedRef.current && detectionSourceRef.current === "focus") {
      if (document.hasFocus() && !document.hidden) {
        clearDetectionState("focus regained (window.onfocus)")
      }
    }
  }, [clearDetectionState])

  // Poll focus state: fires sustained-focus-loss detections and clears them on focus regain
  // (PRIMARY clear path since window.onfocus doesn't fire reliably on macOS).
  const checkActiveState = useCallback(() => {
    if (!detectionAllowed() || typeof window === "undefined" || !isDesktopGeminiEligibleRef.current) return

    const hasFocus = document.hasFocus()
    const isVisible = !document.hidden
    const now = Date.now()

    if (hasDetectedRef.current) {
      if (detectionSourceRef.current !== "focus") return

      if (hasFocus && isVisible) {
        clearDetectionState("focus regained (document.hasFocus poll)")
      } else if (now - lastDetectionTimeRef.current > FOCUS_DETECTION_SAFETY_CLEAR_MS) {
        // Safety mechanism: focus events may be unreliable — never block indefinitely.
        clearDetectionState("auto-dismissed after safety timeout")
      }
      return
    }

    if (!hasFocus && isVisible && !isInClearCooldown()) {
      if (focusLossStartTimeRef.current === 0) {
        focusLossStartTimeRef.current = now
      } else if (
        now - focusLossStartTimeRef.current >= SUSTAINED_FOCUS_LOSS_MS &&
        now - lastDetectionTimeRef.current >= debounceDelay
      ) {
        registerDetection(
          "focus",
          `${isMacOSDesktopRef.current ? "macOS" : "Windows"}: Sustained focus loss (${Math.round(SUSTAINED_FOCUS_LOSS_MS / 1000)}s+) while the assessment stayed visible (possible AI assistant overlay)`,
        )
      }
    } else if (hasFocus) {
      focusLossStartTimeRef.current = 0
    }
  }, [detectionAllowed, registerDetection, clearDetectionState, isInClearCooldown])

  // Method 4: Fullscreen Enforcement - Force fullscreen to block overlays (macOS and Windows)
  // This prevents Gemini pop-ups/side-panels from overlaying the assessment
  // NOTE: Disabled on mobile devices - mobile can't run multiple tabs/Gemini concurrently
  const enforceFullscreen = useCallback(async () => {
    if (!enabled || typeof window === "undefined" || isPhoneOrTabletDevice()) return

    try {
      const element = document.documentElement

      // Check if already in fullscreen
      if (isDocumentFullscreen()) {
        fullscreenEnforcedRef.current = true
        return
      }

      const entered = await requestDocumentFullscreen(element)
      if (entered) {
        fullscreenEnforcedRef.current = true
      }
    } catch (error) {
      // Fullscreen request failed (user denied or not supported)
      // This is okay - we'll continue with other detection methods
      console.warn("[Gemini Detector] Fullscreen request failed:", error)
    }
  }, [enabled])

  const aiHeuristicsEnabled =
    enabled &&
    !skipBrowserAiHeuristics &&
    (typeof window === "undefined" ||
      (!isDesktopElectronAssessmentClient() && shouldUseDesktopGeminiHeuristics()))

  const fullscreenLockEnabled =
    enabled &&
    requireFullscreen === true &&
    (typeof window === "undefined" || !isPhoneOrTabletDevice())

  // Set up resize listener for layout detection (desktop only)
  useEffect(() => {
    if (!aiHeuristicsEnabled || typeof window === "undefined") return

    lastWidthRef.current = window.innerWidth
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [aiHeuristicsEnabled, handleResize])

  // Set up periodic side-panel fingerprint check (desktop only)
  useEffect(() => {
    if (!aiHeuristicsEnabled || typeof window === "undefined") return

    // Calibrate the baseline before the first check so pre-existing chrome never fires.
    baselineChromeWidthRef.current = null
    panelStreakRef.current = 0
    checkForSidePanel()

    const interval = setInterval(() => {
      checkForSidePanel()
    }, 1500)

    return () => {
      clearInterval(interval)
    }
  }, [aiHeuristicsEnabled, checkForSidePanel])

  // macOS/Windows desktop: focus/visibility monitoring
  useEffect(() => {
    if (!aiHeuristicsEnabled || typeof window === "undefined") return

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
  }, [aiHeuristicsEnabled, handleWindowBlur, handleWindowFocus, checkActiveState])

  // Fullscreen Enforcement: Enforce fullscreen on macOS and Windows to block overlays/side-panels
  useEffect(() => {
    if (!fullscreenLockEnabled || typeof window === "undefined") return

    // Attempt to enter fullscreen when enabled (only once)
    enforceFullscreen()

    // Block ESC key from exiting fullscreen
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block ESC key when in fullscreen to prevent exit
      if (e.key === "Escape" || e.keyCode === 27) {
        if (isDocumentFullscreen() && fullscreenLockEnabled) {
          e.preventDefault()
          e.stopPropagation()
          // Immediately re-enter fullscreen if they try to exit
          enforceFullscreen()
        }
      }
    }

    // Monitor fullscreen state changes
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = isDocumentFullscreen()

      fullscreenEnforcedRef.current = isCurrentlyFullscreen
      setIsFullscreen(isCurrentlyFullscreen)

      // Entering/exiting fullscreen changes innerWidth dramatically — rebaseline and grace.
      baselineChromeWidthRef.current = null
      panelStreakRef.current = 0
      orientationGraceUntilRef.current = Date.now() + ZOOM_CHANGE_GRACE_MS

      // CRITICAL: If user exits fullscreen, immediately try to re-enter (no delay)
      // This prevents students from using browser menus to exit fullscreen
      if (!isCurrentlyFullscreen && fullscreenLockEnabled) {
        if (macDetectionTimeoutRef.current) {
          clearTimeout(macDetectionTimeoutRef.current)
        }
        // Use minimal delay (100ms) to allow browser to process exit, then immediately re-enter
        macDetectionTimeoutRef.current = setTimeout(() => {
          enforceFullscreen()
        }, 100)
      }
    }

    // Initial fullscreen check
    const checkFullscreen = () => {
      const isCurrentlyFullscreen = isDocumentFullscreen()
      setIsFullscreen(isCurrentlyFullscreen)
      fullscreenEnforcedRef.current = isCurrentlyFullscreen
    }

    checkFullscreen()

    const unsubscribeFullscreen = subscribeDocumentFullscreen(handleFullscreenChange)
    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      if (macDetectionTimeoutRef.current) {
        clearTimeout(macDetectionTimeoutRef.current)
      }
      unsubscribeFullscreen()
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [fullscreenLockEnabled, enforceFullscreen])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
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
      timestamp: new Date().toISOString(),
    })

    hasDetectedRef.current = false
    detectionSourceRef.current = null
    focusLossStartTimeRef.current = 0
    panelStreakRef.current = 0
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
    isFullscreenRequired: requireFullscreen === true ? fullscreenLockEnabled : false,
  }
}
