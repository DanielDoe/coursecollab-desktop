"use client"

import * as React from "react"

function getReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Defer scroll-triggered landing animations until after first paint + idle. */
export function useLandingEffectsEnabled() {
  const reducedMotion = React.useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", onStoreChange)
      return () => mq.removeEventListener("change", onStoreChange)
    },
    getReducedMotion,
    () => false,
  )

  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    if (reducedMotion) return

    let cancelled = false
    const enable = () => {
      if (!cancelled) setEnabled(true)
    }

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(enable, { timeout: 200 })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    }

    const timer = setTimeout(enable, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reducedMotion])

  return enabled && !reducedMotion
}
