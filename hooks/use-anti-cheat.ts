"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { isBrowserAiEnforcementPlatform } from "@/lib/device-utils"

export interface AntiCheatConfig {
  strictModeEnabled: boolean
  blockCopyPaste: boolean
  trackTabSwitches: boolean
  trackMouseMovement: boolean
  warnOnTabSwitch: boolean
  maxTabSwitches: number
  autoSubmitOnViolations: boolean
  trackGeminiWindow: boolean
  maxGeminiStrikes: number
  /** When true, students must enter fullscreen before starting. Default false for easier testing. */
  requireFullscreen?: boolean
  /** When true, temporarily disable tab/Gemini/copy-paste monitoring (e.g. solution file picker). */
  suspended?: boolean
  /** When true (default), record and send keystroke data for code questions to enforce anti-cheat deductions. */
  keystrokePlaybackEnforced?: boolean
}

export interface ViolationLog {
  type:
    | "tab_switch"
    | "copy_paste"
    | "mouse_leave"
    | "paste_attempt"
    | "copy_attempt"
    | "gemini_window"
    | "context_menu"
    | "drag_attempt"
    | "print_attempt"
    | "devtools_attempt"
  timestamp: string
  details?: string
}

export interface AntiCheatState {
  tabSwitchCount: number
  copyPasteAttempts: number
  mouseLeaveCount: number
  geminiStrikes: number
  violations: ViolationLog[]
  isWindowFocused: boolean
  showWarning: boolean
  warningMessage: string
  warningType: "tab_switch" | "copy_paste" | "mouse_leave" | "gemini_window" | null
}

interface UseAntiCheatOptions {
  config: AntiCheatConfig
  onViolation?: (violation: ViolationLog) => void
  onMaxViolations?: (violationType: "tab_switch" | "gemini_window", count: number) => void
  attemptId?: string
  /** Synchronous guard (e.g. solution file picker) — checked before config.suspended state updates. */
  isAntiCheatSuspended?: () => boolean
}

export function useAntiCheat({ config, onViolation, onMaxViolations, attemptId, isAntiCheatSuspended }: UseAntiCheatOptions) {
  const [state, setState] = useState<AntiCheatState>({
    tabSwitchCount: 0,
    copyPasteAttempts: 0,
    mouseLeaveCount: 0,
    geminiStrikes: 0,
    violations: [],
    isWindowFocused: true,
    showWarning: false,
    warningMessage: "",
    warningType: null,
  })
  
  // Sync ref with state to prevent race conditions
  useEffect(() => {
    tabSwitchCountRef.current = state.tabSwitchCount
  }, [state.tabSwitchCount])

  useEffect(() => {
    geminiStrikesCountRef.current = state.geminiStrikes
  }, [state.geminiStrikes])

  const violationTimeoutRef = useRef<NodeJS.Timeout>()
  const lastGeminiIncrementRef = useRef<number>(0)
  const incrementDebounceDelay = 3000 // 3 seconds debounce
  const geminiStrikesCountRef = useRef<number>(0) // Track actual Gemini strikes count to prevent race conditions
  const geminiProcessingRef = useRef<boolean>(false) // Prevent concurrent Gemini strike processing
  const lastTabSwitchRef = useRef<number>(0)
  const tabSwitchDebounceDelay = 2000 // 2 seconds debounce for tab switches to prevent double counting
  const tabSwitchProcessingRef = useRef<boolean>(false) // Prevent concurrent processing
  const tabSwitchCountRef = useRef<number>(0) // Track actual count to prevent race conditions
  const lastProcessedEventIdRef = useRef<string | null>(null) // Track last processed event to prevent duplicates
  const onMaxViolationsTriggeredRef = useRef<boolean>(false) // Prevent multiple calls to onMaxViolations
  const configRef = useRef(config)
  const isAntiCheatSuspendedRef = useRef(isAntiCheatSuspended)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    isAntiCheatSuspendedRef.current = isAntiCheatSuspended
  }, [isAntiCheatSuspended])

  const antiCheatPaused = useCallback(() => {
    return configRef.current.suspended === true || isAntiCheatSuspendedRef.current?.() === true
  }, [])

  // Track last logged violation to prevent duplicate API calls
  const lastLoggedViolationRef = useRef<{ type: string; timestamp: number } | null>(null)
  // Mobile-specific refs for keyboard and gesture detection
  const keyboardOpenTimeRef = useRef<number>(0)
  const lastViewportHeightRef = useRef<number>(typeof window !== "undefined" ? window.innerHeight : 0)
  const lastVisibilityChangeTimeRef = useRef<number>(0)
  const visibilityChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const violationLogDebounceDelay = 1000 // 1 second debounce for API calls

  // Log violation
  const logViolation = useCallback(
    (type: ViolationLog["type"], details?: string, metadata?: Record<string, any>) => {
      const now = Date.now()
      
      // CRITICAL: Debounce API calls to prevent duplicate logging
      // BUT: For Gemini events, only debounce 'detected' events, not 'dismissed' or 'active' events
      const lastLogged = lastLoggedViolationRef.current
      const eventType = metadata?.eventType
      const shouldDebounce = !eventType || eventType === "detected" // Only debounce 'detected' events
      
      if (shouldDebounce && lastLogged && 
          lastLogged.type === type && 
          now - lastLogged.timestamp < violationLogDebounceDelay) {
        return
      }
      
      // Update last logged violation
      lastLoggedViolationRef.current = { type, timestamp: now }
      
      const violation: ViolationLog & { eventType?: string; [key: string]: any } = {
        type,
        timestamp: new Date().toISOString(),
        details,
        ...metadata, // Include metadata (eventType, etc.)
      }

      setState((prev) => ({
        ...prev,
        violations: [...prev.violations, violation],
      }))

      // Call external violation handler
      if (onViolation) {
        onViolation(violation)
      }

      // Log to server if attemptId is provided
      if (attemptId) {
        fetch("/api/quiz/log-violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            violation,
          }),
        }).catch((error) => {
          console.error("Failed to log violation to server:", error)
        })
      }
    },
    [onViolation, attemptId]
  )

  // Show warning modal
  const showWarningModal = useCallback(
    (type: AntiCheatState["warningType"], message: string) => {
      setState((prev) => ({
        ...prev,
        showWarning: true,
        warningMessage: message,
        warningType: type,
      }))

      // CRITICAL: For Gemini violations, do NOT auto-hide - keep warning open until violation is cleared
      // For other violations (tab_switch, copy_paste), auto-hide after 5 seconds
      if (type !== "gemini_window") {
        // Auto-hide warning after 5 seconds for non-blocking violations
        if (violationTimeoutRef.current) {
          clearTimeout(violationTimeoutRef.current)
        }
        violationTimeoutRef.current = setTimeout(() => {
          setState((prev) => {
            // Only auto-hide if it's still the same warning type (not changed to gemini_window)
            if (prev.warningType === type && type !== "gemini_window") {
              return {
                ...prev,
                showWarning: false,
              }
            }
            return prev
          })
        }, 5000)
      } else {
        // For Gemini violations, clear any existing timeout and keep warning open
        if (violationTimeoutRef.current) {
          clearTimeout(violationTimeoutRef.current)
          violationTimeoutRef.current = undefined
        }
      }
    },
    []
  )

  // Close warning modal
  const closeWarning = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showWarning: false,
    }))
  }, [])

  // Handle copy/paste blocking
  useEffect(() => {
    if (!config.blockCopyPaste) return

    const handleCopy = (e: ClipboardEvent) => {
      if (antiCheatPaused()) return
      e.preventDefault()
      setState((prev) => ({
        ...prev,
        copyPasteAttempts: prev.copyPasteAttempts + 1,
      }))
      logViolation("copy_attempt", "Attempted to copy content")
      showWarningModal(
        "copy_paste",
        "⚠️ Copy function is disabled during this assessment. Please type your answers directly."
      )
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (antiCheatPaused()) return
      e.preventDefault()
      setState((prev) => ({
        ...prev,
        copyPasteAttempts: prev.copyPasteAttempts + 1,
      }))
      logViolation("paste_attempt", "Attempted to paste content")
      showWarningModal(
        "copy_paste",
        "⚠️ Paste function is disabled during this assessment. Please type your answers directly."
      )
    }

    const handleCut = (e: ClipboardEvent) => {
      if (antiCheatPaused()) return
      e.preventDefault()
      setState((prev) => ({
        ...prev,
        copyPasteAttempts: prev.copyPasteAttempts + 1,
      }))
      logViolation("copy_attempt", "Attempted to cut content")
      showWarningModal(
        "copy_paste",
        "⚠️ Cut function is disabled during this assessment. Please type your answers directly."
      )
    }

    // Block keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (antiCheatPaused()) return
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Cmd+C, Cmd+V, Cmd+X
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "v" || e.key === "x" || e.key === "C" || e.key === "V" || e.key === "X")
      ) {
        e.preventDefault()
        setState((prev) => ({
          ...prev,
          copyPasteAttempts: prev.copyPasteAttempts + 1,
        }))
        logViolation("copy_paste", `Attempted keyboard shortcut: ${e.key}`)
        showWarningModal(
          "copy_paste",
          "⚠️ Copy/Paste shortcuts are disabled during this assessment. Please type your answers directly."
        )
      }
    }

    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("cut", handleCut)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("cut", handleCut)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [config.blockCopyPaste, logViolation, showWarningModal, antiCheatPaused])

  // Context menu + drag-out blocking — gated on blockCopyPaste so "superpowers"
  // copy/paste permissions keep the browser's native menus available.
  useEffect(() => {
    if (!config.blockCopyPaste) return

    const handleContextMenu = (e: MouseEvent) => {
      if (antiCheatPaused()) return
      e.preventDefault()
      logViolation("context_menu", "Right-click context menu blocked during assessment")
    }

    const handleDragStart = (e: DragEvent) => {
      if (antiCheatPaused()) return
      e.preventDefault()
      logViolation("drag_attempt", "Attempted to drag content out of the assessment")
    }

    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("dragstart", handleDragStart)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("dragstart", handleDragStart)
    }
  }, [config.blockCopyPaste, logViolation, antiCheatPaused])

  // Strict-mode lockdown: block print/save-page and DevTools shortcuts.
  useEffect(() => {
    if (!config.strictModeEnabled) return

    const handleBeforePrint = () => {
      if (antiCheatPaused()) return
      logViolation("print_attempt", "Print dialog opened during assessment")
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (antiCheatPaused()) return
      const key = e.key.toLowerCase()
      const hasModifier = e.ctrlKey || e.metaKey

      // Print or save the page (share quiz as PDF loop)
      if (hasModifier && (key === "p" || key === "s")) {
        e.preventDefault()
        logViolation("print_attempt", `Blocked shortcut: ${e.metaKey ? "Cmd" : "Ctrl"}+${key.toUpperCase()}`)
        showWarningModal(
          "copy_paste",
          "⚠️ Printing or saving the assessment is disabled. This attempt has been logged.",
        )
        return
      }

      // DevTools (inspect answers, remove blur overlays, view page source)
      const isDevToolsShortcut =
        e.key === "F12" ||
        (hasModifier && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(key)) ||
        (hasModifier && !e.shiftKey && key === "u")
      if (isDevToolsShortcut) {
        e.preventDefault()
        logViolation("devtools_attempt", "Blocked developer tools shortcut")
        showWarningModal(
          "copy_paste",
          "⚠️ Developer tools are disabled during this assessment. This attempt has been logged.",
        )
      }
    }

    window.addEventListener("beforeprint", handleBeforePrint)
    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [config.strictModeEnabled, logViolation, showWarningModal, antiCheatPaused])

  // Handle tab visibility tracking
  useEffect(() => {
    if (!config.trackTabSwitches) return

    // Import mobile detection utility
    const isMobileDevice = () => {
      if (typeof window === "undefined" || typeof navigator === "undefined") return false
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
      const isMobileUserAgent = mobileRegex.test(userAgent)
      const isMobileWidth = window.innerWidth <= 768
      const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      return isMobileUserAgent || (isMobileWidth && hasTouchSupport)
    }

    const isMobile = isMobileDevice()
    
    // Initialize viewport height ref
    if (typeof window !== "undefined") {
      lastViewportHeightRef.current = window.innerHeight
    }
    
    // Detect keyboard opening/closing on mobile
    const handleResize = () => {
      if (!isMobile || typeof window === "undefined") return
      
      const currentHeight = window.innerHeight
      const heightDiff = lastViewportHeightRef.current - currentHeight
      
      // Keyboard typically causes 200-400px height reduction on mobile
      if (heightDiff > 150) {
        // Keyboard likely opened
        keyboardOpenTimeRef.current = Date.now()
      } else if (heightDiff < -150) {
        // Keyboard likely closed
        keyboardOpenTimeRef.current = Date.now()
      }
      
      lastViewportHeightRef.current = currentHeight
    }
    
    window.addEventListener('resize', handleResize)
    
    const handleVisibilityChange = () => {
      if (antiCheatPaused()) return
      const isHidden = document.hidden
      const now = Date.now()
      
      // CRITICAL: On mobile/iPad, ignore visibility changes that occur shortly after keyboard events
      // This prevents false positives from swiping gestures and keyboard opening/closing
      if (isMobile) {
        const timeSinceKeyboardEvent = now - keyboardOpenTimeRef.current
        // Ignore visibility changes within 2 seconds of keyboard events
        if (timeSinceKeyboardEvent < 2000) {
          console.log("[Anti-Cheat] Ignoring visibility change on mobile (likely keyboard-related)")
          return
        }
        
        // On mobile, track brief visibility changes (< 1 second)
        // Real tab switches typically last longer, while gestures/keyboard are brief
        if (isHidden) {
          lastVisibilityChangeTimeRef.current = now
          // Clear any existing timeout
          if (visibilityChangeTimeoutRef.current) {
            clearTimeout(visibilityChangeTimeoutRef.current)
          }
          // Set timeout to check if visibility was restored quickly
          visibilityChangeTimeoutRef.current = setTimeout(() => {
            if (!document.hidden && (Date.now() - lastVisibilityChangeTimeRef.current) < 1000) {
              console.log("[Anti-Cheat] Ignoring brief visibility change on mobile (likely gesture-related)")
              return
            }
          }, 1000)
        } else {
          // Tab regained focus - check if it was a brief change
          const timeSinceHidden = now - lastVisibilityChangeTimeRef.current
          if (timeSinceHidden < 1000 && lastVisibilityChangeTimeRef.current > 0) {
            console.log("[Anti-Cheat] Ignoring brief visibility change on mobile (likely gesture-related)")
            if (visibilityChangeTimeoutRef.current) {
              clearTimeout(visibilityChangeTimeoutRef.current)
              visibilityChangeTimeoutRef.current = null
            }
            return
          }
        }
      }

      if (isHidden) {
        // CRITICAL: Debounce tab switch detection to prevent double counting
        const now = Date.now()
        const timeSinceLastSwitch = now - lastTabSwitchRef.current
        
        // CRITICAL: Create unique event ID based on timestamp (rounded to nearest 10ms)
        // This helps identify and prevent processing the same event twice
        // Using 10ms to catch events that fire within milliseconds of each other (like 1ms apart)
        const eventId = `${Math.floor(now / 10)}`
        
        // CRITICAL: Check if we just processed this exact event (within 10ms window)
        if (lastProcessedEventIdRef.current === eventId) {
          return
        }
        
        // CRITICAL: Check debounce FIRST before setting processing flag
        // This prevents race conditions where multiple events fire simultaneously
        if (timeSinceLastSwitch < tabSwitchDebounceDelay) {
          return
        }
        
        // CRITICAL: Check processing flag AFTER debounce check
        // If already processing, ignore this event (prevents double processing)
        if (tabSwitchProcessingRef.current) {
          return
        }
        
        // CRITICAL: Set processing flag, timestamp, and event ID IMMEDIATELY (atomically)
        // This must happen BEFORE any async operations to prevent race conditions
        tabSwitchProcessingRef.current = true
        lastTabSwitchRef.current = now
        lastProcessedEventIdRef.current = eventId
        
        // Schedule flag clearing after debounce period + buffer
        // This ensures the flag stays set long enough to prevent rapid duplicate events
        setTimeout(() => {
          tabSwitchProcessingRef.current = false
          // Clear event ID after debounce period to allow new events
          setTimeout(() => {
            lastProcessedEventIdRef.current = null
          }, 100)
        }, tabSwitchDebounceDelay + 200) // Clear flag after debounce period + 200ms buffer

        // Tab lost focus - check BEFORE incrementing to prevent counting beyond max
        // CRITICAL: Use ref to get current count to avoid race conditions with async setState
        const currentCount = tabSwitchCountRef.current
        
        // CRITICAL: Check if we've already processed this exact count increment
        // This prevents duplicate setState calls from processing the same increment
        if (currentCount >= config.maxTabSwitches) {
          // Clear processing flag and return early
          setTimeout(() => {
            tabSwitchProcessingRef.current = false
          }, 100)
          return
        }
        
        // CRITICAL: Increment count in ref FIRST (before setState) to prevent race conditions
        const newCount = currentCount + 1
        tabSwitchCountRef.current = newCount
        
        setState((prev) => {
          // CRITICAL: Use the ref value (already incremented) to ensure consistency
          // If state is behind ref, use ref value; otherwise use state value
          const actualCount = Math.max(prev.tabSwitchCount, tabSwitchCountRef.current)
          
          // CRITICAL: Double-check we haven't already processed this increment
          // This prevents duplicate setState calls from incrementing twice

          // CRITICAL: Check if max already reached - if so, don't increment and trigger auto-submit
          if (actualCount >= config.maxTabSwitches) {
            // CRITICAL: Don't call onMaxViolations from inside setState - it will be called outside
            // This prevents duplicate calls if setState runs multiple times
            // Return state unchanged - don't increment beyond max
            return {
              ...prev,
              isWindowFocused: false,
            }
          }

          // CRITICAL: Use the ref value (already incremented) instead of incrementing again
          // This ensures consistency even if setState is called multiple times
          const finalCount = Math.max(actualCount, tabSwitchCountRef.current)
          const hasReachedMax = finalCount >= config.maxTabSwitches

          return {
            ...prev,
            tabSwitchCount: finalCount, // Use ref value to ensure consistency
            isWindowFocused: false,
          }
        })
        
        // CRITICAL: Call logViolation OUTSIDE of setState to prevent duplicate API calls
        // This ensures only ONE API call is made per tab switch, even if setState is called multiple times
        // Use the count we already incremented in the ref
        logViolation("tab_switch", "User switched away from assessment tab")
        
        // Get the updated count from ref (already incremented above)
        const updatedCount = tabSwitchCountRef.current
        const hasReachedMax = updatedCount >= config.maxTabSwitches
        
        // Show warning if enabled
        if (config.warnOnTabSwitch) {
          if (hasReachedMax) {
            showWarningModal(
              "tab_switch",
              `⚠️ CRITICAL WARNING: Maximum tab switches reached (${updatedCount}/${config.maxTabSwitches}). Your assessment will be automatically submitted.`
            )
          } else {
            showWarningModal(
              "tab_switch",
              "⚠️ Warning: You have switched away from the assessment tab. This action has been logged."
            )
          }
        }

        // If max reached, trigger auto-submit immediately
        // CRITICAL: Only call onMaxViolations ONCE, even if this handler runs multiple times
        if (hasReachedMax && !onMaxViolationsTriggeredRef.current) {
          if (config.autoSubmitOnViolations && onMaxViolations) {
            // CRITICAL: Set flag BEFORE calling to prevent duplicate calls
            onMaxViolationsTriggeredRef.current = true
            onMaxViolations("tab_switch", updatedCount)
          }
        }
        
        // Processing flag is cleared by the timeout set at the start of the handler
        // No need to clear it here to avoid race conditions
      } else {
        // Tab regained focus
        setState((prev) => ({
          ...prev,
          isWindowFocused: true,
        }))
      }
    }

    const handleBlur = () => {
      // CRITICAL: On mobile/iPad, ignore blur events that occur during keyboard interactions
      // Blur can be triggered by keyboard opening, which is not a tab switch
      if (isMobile) {
        const timeSinceKeyboardEvent = Date.now() - keyboardOpenTimeRef.current
        if (timeSinceKeyboardEvent < 2000) {
          console.log("[Anti-Cheat] Ignoring blur event on mobile (likely keyboard-related)")
          return
        }
      }
      
      setState((prev) => ({
        ...prev,
        isWindowFocused: false,
      }))
    }

    const handleFocus = () => {
      setState((prev) => ({
        ...prev,
        isWindowFocused: true,
      }))
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("resize", handleResize)
      if (visibilityChangeTimeoutRef.current) {
        clearTimeout(visibilityChangeTimeoutRef.current)
      }
    }
  }, [config.trackTabSwitches, config.warnOnTabSwitch, config.maxTabSwitches, config.autoSubmitOnViolations, logViolation, showWarningModal, onMaxViolations, antiCheatPaused])

  // Handle mouse movement tracking
  useEffect(() => {
    if (!config.trackMouseMovement) return

    const handleMouseLeave = () => {
      setState((prev) => ({
        ...prev,
        mouseLeaveCount: prev.mouseLeaveCount + 1,
      }))
      // Silent logging - no warnings to student
      // Just log to database for admin review
      logViolation("mouse_leave", "Mouse left assessment window")
    }

    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [config.trackMouseMovement, logViolation])

  // Function to manually increment Gemini strikes and show warning
  // CRITICAL: Must be defined BEFORE the useEffect that uses it
  const incrementGeminiStrike = useCallback((reason: string) => {
    if (antiCheatPaused() || !config.trackGeminiWindow || !isBrowserAiEnforcementPlatform()) {
      return
    }

    // CRITICAL: Prevent concurrent processing - check processing flag FIRST
    if (geminiProcessingRef.current) {
      return
    }

    // Debounce: prevent multiple increments within debounce window
    const now = Date.now()
    if (now - lastGeminiIncrementRef.current < incrementDebounceDelay) {
      return
    }

    // CRITICAL: Check current count from ref (source of truth) before incrementing
    const currentStrikes = geminiStrikesCountRef.current
    if (currentStrikes >= config.maxGeminiStrikes) {
      return
    }

    // Set processing flag to prevent concurrent increments
    geminiProcessingRef.current = true
    lastGeminiIncrementRef.current = now

    // Calculate new strikes count
    const newStrikes = currentStrikes + 1
    const hasReachedMax = newStrikes >= config.maxGeminiStrikes

    setState((prev) => {
      // Double-check: ensure we're not incrementing beyond max
      if (prev.geminiStrikes >= config.maxGeminiStrikes) {
        geminiProcessingRef.current = false // Release lock
        return prev
      }

      return {
        ...prev,
        geminiStrikes: newStrikes, // Cap at max to prevent negative remaining counts
      }
    })

    // CRITICAL: Call logViolation OUTSIDE of setState to prevent duplicate API calls
    // This ensures only ONE API call is made per strike increment, even if setState runs multiple times
    // Include eventType in the violation object for server-side logging
    logViolation("gemini_window", reason, { eventType: "detected" })

    // Show warning modal with strike count
    const remainingStrikes = config.maxGeminiStrikes - newStrikes
    const warningMessage = hasReachedMax
      ? `⚠️ CRITICAL WARNING: Maximum Gemini strikes reached (${newStrikes}/${config.maxGeminiStrikes}). The quiz is blocked. Please close the AI tool to continue.`
      : `⚠️ Browser AI Tool Detected: A browser AI side-panel (like Gemini) has been detected. You have ${remainingStrikes} strike${remainingStrikes === 1 ? '' : 's'} remaining. Please close it immediately to continue the exam.`

    showWarningModal("gemini_window", warningMessage)
    
    // Release processing lock
    geminiProcessingRef.current = false
    
    // If max reached, notify but DO NOT auto-submit for Gemini violations
    // Gemini violations should only block the quiz, not auto-submit
    // CRITICAL: Only call onMaxViolations ONCE, even if this handler runs multiple times
    if (hasReachedMax && !onMaxViolationsTriggeredRef.current) {
      // CRITICAL: For Gemini violations, always call onMaxViolations but it will handle blocking without auto-submit
      // For other violations, check autoSubmitOnViolations config
      if (onMaxViolations) {
        // CRITICAL: Set flag BEFORE calling to prevent duplicate calls
        onMaxViolationsTriggeredRef.current = true
        onMaxViolations("gemini_window", newStrikes)
        // Note: onMaxViolations will handle blocking without auto-submit for Gemini violations
      }
    }
  }, [config.trackGeminiWindow, config.maxGeminiStrikes, config.autoSubmitOnViolations, logViolation, showWarningModal, onMaxViolations, antiCheatPaused])

  // Handle Gemini window detection
  useEffect(() => {
    if (!config.trackGeminiWindow || !isBrowserAiEnforcementPlatform()) return

    let focusBlurCount = 0
    let rapidSwitchTimer: NodeJS.Timeout | null = null
    let lastBlurTime = 0
    const RAPID_SWITCH_THRESHOLD = 2000 // 2 seconds - rapid switching indicates possible Gemini use
    const FOCUS_BLUR_WINDOW = 5000 // 5 seconds window to detect rapid focus/blur cycles

    const detectGeminiPattern = () => {
      if (antiCheatPaused()) return
      focusBlurCount++
      
      // Clear previous timer
      if (rapidSwitchTimer) {
        clearTimeout(rapidSwitchTimer)
      }

      // CRITICAL: Only detect Gemini if we have RAPID switching (3+ switches within threshold)
      // Normal tab switches (1-2 switches) should NOT trigger Gemini detection
      // This prevents false positives from normal tab switching behavior
      const timeSinceLastBlur = Date.now() - lastBlurTime
      if (timeSinceLastBlur < RAPID_SWITCH_THRESHOLD && focusBlurCount >= 3) {
        setState((prev) => {
          // CRITICAL: Check if max already reached - if so, don't increment and trigger auto-submit
          if (prev.geminiStrikes >= config.maxGeminiStrikes) {
            // Max already reached - trigger auto-submit immediately if not already triggered
            if (config.autoSubmitOnViolations && onMaxViolations) {
              onMaxViolations("gemini_window", prev.geminiStrikes)
            }
            // Return state unchanged - don't increment beyond max
            return prev
          }

          // Increment strikes (we're below max)
          const newStrikes = prev.geminiStrikes + 1
          const hasReachedMax = newStrikes >= config.maxGeminiStrikes
          
          // Log violation
          logViolation("gemini_window", `Rapid window switching detected (${focusBlurCount} switches in ${timeSinceLastBlur}ms) - Possible Gemini window usage`)
          
          // Show warning
          if (hasReachedMax) {
            showWarningModal(
              "gemini_window",
              `⚠️ CRITICAL WARNING: Maximum Gemini strikes reached (${newStrikes}/${config.maxGeminiStrikes}). Your assessment will be automatically submitted.`
            )
          } else if (newStrikes > 0) {
            showWarningModal(
              "gemini_window",
              `⚠️ Warning: Suspicious window activity detected (${newStrikes}/${config.maxGeminiStrikes} strikes). Browser AI tools are not permitted during assessments.`
            )
          }
          
          // If max reached, trigger auto-submit immediately
          if (hasReachedMax && config.autoSubmitOnViolations && onMaxViolations) {
            onMaxViolations("gemini_window", newStrikes)
          }
          
          return {
            ...prev,
            geminiStrikes: newStrikes, // Cap at max to prevent negative remaining counts
          }
        })
        
        focusBlurCount = 0 // Reset counter
      }

      // Reset counter after window expires
      rapidSwitchTimer = setTimeout(() => {
        focusBlurCount = 0
      }, FOCUS_BLUR_WINDOW)
    }

    // CRITICAL: Disable Gemini detection via visibilitychange/blur/focus when tab switching tracking is enabled
    // This prevents false positives - normal tab switches should NOT trigger Gemini detection
    // Gemini detection should ONLY come from:
    // 1. Resize events (detected by useGeminiDetector hook)
    // 2. Keyboard shortcuts (Ctrl+Shift+G)
    // 3. Manual incrementGeminiStrike calls from question renderer
    const handleBlur = () => {
      // Do nothing - tab switches are handled by separate useEffect
      // This prevents false positives from normal tab switching
    }

    const handleFocus = () => {
      // Do nothing - tab switches are handled by separate useEffect
      // This prevents false positives from normal tab switching
    }

    // Monitor visibility changes (more reliable than blur/focus)
    // CRITICAL: DISABLED - Normal tab switches should NOT trigger Gemini detection
    // Only resize events and keyboard shortcuts should trigger Gemini detection
    const handleVisibilityChange = () => {
      // Do nothing - tab switches are handled by separate useEffect
      // This prevents false positives from normal tab switching
      // Gemini detection comes from useGeminiDetector hook (resize events) and keyboard shortcuts only
    }

    // Monitor for Gemini-specific keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (antiCheatPaused()) return
      // Detect Ctrl/Cmd + Shift + G (Gemini activation)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        // CRITICAL: Use centralized incrementGeminiStrike function to prevent double-counting
        // This ensures all debouncing, ref guards, and processing flags are respected
        incrementGeminiStrike("Gemini activation shortcut detected (Ctrl/Cmd + Shift + G)")
      }
    }

    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("keydown", handleKeyDown, true)
      if (rapidSwitchTimer) {
        clearTimeout(rapidSwitchTimer)
      }
    }
  }, [config.trackGeminiWindow, config.maxGeminiStrikes, config.autoSubmitOnViolations, logViolation, showWarningModal, onMaxViolations, incrementGeminiStrike, antiCheatPaused])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current)
      }
    }
  }, [])

  return {
    state,
    closeWarning,
    logViolation,
    incrementGeminiStrike,
  }
}

