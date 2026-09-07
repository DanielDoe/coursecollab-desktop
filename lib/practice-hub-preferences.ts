/** Practice Hub UI preferences (course eval: disable unwanted fullscreen / viewport jump on mobile). */

const KEY = "cc_practice_compact_layout"

export function getPracticeCompactLayoutPreference(): boolean {
  if (typeof window === "undefined") return true
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === "false") return false
    if (stored === "true") return true
  } catch {
    /* ignore */
  }
  // Default on: mobile/tablet narrow screens avoid immersive viewport jumps
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 1024px)").matches
  }
  return true
}

export function setPracticeCompactLayoutPreference(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, enabled ? "true" : "false")
  } catch {
    /* ignore */
  }
}
