/**
 * Camera strategy for solution uploads.
 * Mobile (iOS/Android): native <input capture> — opens the device camera app reliably.
 * Desktop: in-page getUserMedia preview via SolutionCameraDialog.
 */

/** iPadOS 13+ reports as MacIntel with touch points. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android/i.test(navigator.userAgent)
}

export function isMobileOrTablet(): boolean {
  return isIOSDevice() || isAndroidDevice()
}

/** Native file input with capture=environment — best UX on phones/tablets. */
export function prefersNativeCameraCapture(): boolean {
  return isMobileOrTablet()
}

export function canUseInPageCamera(): boolean {
  if (typeof navigator === "undefined") return false
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext
}
