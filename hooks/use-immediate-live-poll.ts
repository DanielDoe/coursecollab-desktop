"use client"

import { useEffect, useRef } from "react"

/** Interval poll plus an immediate pull on focus, tab visible, and bfcache restore. */
export function useImmediateLivePoll(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    const run = () => {
      void callbackRef.current()
    }
    const id = window.setInterval(run, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") run()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("pageshow", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("pageshow", onVisible)
    }
  }, [enabled, intervalMs])
}
