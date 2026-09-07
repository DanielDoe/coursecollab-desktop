/**
 * Device detection utilities
 */

function hasTouchSupport(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  return "ontouchstart" in window || navigator.maxTouchPoints > 0
}

/**
 * iPadOS 13+ often reports Macintosh in the user agent while still being a touch tablet.
 */
export function isIPadOS(): boolean {
  if (typeof navigator === "undefined") return false
  const userAgent = navigator.userAgent || ""
  return /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1
}

/**
 * Detect if the user is on a mobile device (phones and small touch screens)
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i
  const isPhoneUserAgent = mobileRegex.test(userAgent)
  const isMobileWidth = window.innerWidth <= 768

  return isPhoneUserAgent || (isMobileWidth && hasTouchSupport())
}

/**
 * Detect if the user is on a tablet device (iPad, Android tablets, large touch screens)
 */
export function isTabletDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }

  if (isIPadOS()) return true

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i
  const isTabletUserAgent = tabletRegex.test(userAgent)

  // Tablets in landscape can exceed 1024px (iPad Pro 12.9")
  const isTabletWidth =
    window.innerWidth >= 768 && window.innerWidth <= 1366 && hasTouchSupport()

  return isTabletUserAgent || isTabletWidth
}

/**
 * Detect if the user is on a desktop device (not mobile or tablet)
 */
export function isDesktopDevice(): boolean {
  return !isMobileDevice() && !isTabletDevice()
}

/**
 * Touch-primary devices where hover is unavailable (common on phones/tablets).
 */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === "undefined") return false
  try {
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(hover: none)").matches
    )
  } catch {
    return false
  }
}

/**
 * Resize, side-panel, and focus heuristics only work on desktop browsers with a mouse.
 * Phones, iPads, and touch-primary devices get false positives from scroll, rotate, zoom, and Safari chrome.
 */
export function shouldUseDesktopGeminiHeuristics(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  if (isMobileDevice() || isTabletDevice() || isIPadOS()) return false
  if (isTouchPrimaryDevice() && navigator.maxTouchPoints > 0) return false
  return window.innerWidth > 768
}

/**
 * True macOS desktop (excludes iPhone/iPad/iPadOS desktop UA).
 */
export function isMacOSDesktop(): boolean {
  if (typeof navigator === "undefined") return false
  if (!shouldUseDesktopGeminiHeuristics()) return false
  if (isIPadOS()) return false
  if (/iPhone|iPad|iPod/.test(navigator.platform)) return false
  return /Mac/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent)
}

/** Phones and tablets — skip desktop-only UX (fullscreen prompts, etc.). */
export function isPhoneOrTabletDevice(): boolean {
  return isMobileDevice() || isTabletDevice() || isIPadOS()
}

/**
 * Browser AI side-panel detection runs only on Windows/macOS desktop browsers.
 * Excludes iOS, iPadOS, Android phones, and Android tablets (scroll/rotate cause false positives).
 */
export function isBrowserAiEnforcementPlatform(): boolean {
  return shouldUseDesktopGeminiHeuristics()
}

export type BrowserAiAntiCheatFields = {
  trackGeminiWindow?: boolean
  requireFullscreen?: boolean
}

/** Strip browser-AI enforcement on mobile/tablet clients. Safe to call during SSR (no-op). */
export function applyBrowserAiPlatformPolicy<T extends BrowserAiAntiCheatFields>(config: T): T {
  if (typeof window === "undefined" || isBrowserAiEnforcementPlatform()) {
    return config
  }
  return {
    ...config,
    trackGeminiWindow: false,
    ...(config.requireFullscreen !== undefined ? { requireFullscreen: false } : {}),
  }
}
