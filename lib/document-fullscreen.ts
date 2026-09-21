type FullscreenDocumentLike = {
  fullscreenElement?: Element | null
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

const FULLSCREEN_CHANGE_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange",
] as const

/**
 * Vendor-prefixed fullscreen properties are `undefined` in Chromium, not `null`.
 * `undefined !== null` is true, so a `!== null` check always reports fullscreen.
 */
export function isFullscreenFromDocument(doc: FullscreenDocumentLike): boolean {
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  )
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === "undefined") return false
  return isFullscreenFromDocument(document as FullscreenDocumentLike)
}

export async function requestDocumentFullscreen(element?: HTMLElement | null): Promise<boolean> {
  if (typeof document === "undefined") return false
  if (isDocumentFullscreen()) return true

  const el = (element ?? document.documentElement) as FullscreenElement
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen()
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen()
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen()
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen()
    } else {
      return false
    }
    return isDocumentFullscreen()
  } catch {
    return false
  }
}

export function subscribeDocumentFullscreen(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {}

  for (const event of FULLSCREEN_CHANGE_EVENTS) {
    document.addEventListener(event, onChange)
  }

  return () => {
    for (const event of FULLSCREEN_CHANGE_EVENTS) {
      document.removeEventListener(event, onChange)
    }
  }
}
