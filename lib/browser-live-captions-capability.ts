/**
 * In-browser "live captions" use the browser Web Speech API (Chrome/Edge: recognition is
 * typically processed by the vendor speech service over the network — not a local npm library).
 * The mic level bar is driven by the same MediaStream as MediaRecorder; Web Speech opens its own
 * microphone path, so meter motion can look healthy while recognition stays silent.
 * Safari / Firefox / iOS WebKit do not expose a usable SpeechRecognition for this flow.
 */
export type LiveCaptionsPlatform = "chromium" | "unsupported" | "no-api" | "pending"

export function getLiveCaptionsPlatform(): Exclude<LiveCaptionsPlatform, "pending"> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported"

  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return "no-api"

  const ua = navigator.userAgent

  if (/Firefox\//.test(ua)) return "unsupported"

  const maxTouch = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && maxTouch > 1) || /iPhone|iPad/.test(navigator.platform)
  if (isIOS) return "unsupported"

  const isChromiumShell = /Chrome|Chromium|Edg\//.test(ua) || /\bOPR\//.test(ua)
  if (!isChromiumShell && /Safari\//.test(ua)) return "unsupported"

  return "chromium"
}
