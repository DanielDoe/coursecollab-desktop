"use client"

import { useEffect, useRef } from "react"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"

async function requestRendererFullscreen(): Promise<void> {
  if (typeof document === "undefined") return
  const el = document.documentElement
  const already =
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
  if (already) return

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen()
    } else if ((el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
      await (el as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen()
    }
  } catch {
    /* Native kiosk is primary; HTML5 fullscreen is supplemental. */
  }
}

async function exitRendererFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !document.fullscreenElement) return
  try {
    await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}

/**
 * Native exam kiosk (all builds) + renderer fullscreen + periodic reassert while active.
 */
export function useDesktopAssessmentLockdown(active: boolean): void {
  const enteredRef = useRef(false)

  useEffect(() => {
    if (!isDesktopElectronAssessmentClient()) return

    const api = window.courseCollabDesktop
    if (!active) {
      if (enteredRef.current) {
        enteredRef.current = false
        void exitRendererFullscreen()
        void api?.exitAssessmentLockdown?.()
      }
      return
    }

    let cancelled = false
    enteredRef.current = true

    void (async () => {
      const result = await api?.enterAssessmentLockdown?.()
      if (cancelled) {
        enteredRef.current = false
        void api?.exitAssessmentLockdown?.()
        return
      }
      if (!result?.ok) {
        enteredRef.current = false
        return
      }
      await requestRendererFullscreen()
    })()

    const reassertTimer = window.setInterval(() => {
      if (!enteredRef.current) return
      void api?.reassertAssessmentLockdown?.()
      void requestRendererFullscreen()
    }, 2000)

    const onFullscreenChange = () => {
      if (!enteredRef.current) return
      if (!document.fullscreenElement) {
        void requestRendererFullscreen()
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)

    return () => {
      cancelled = true
      window.clearInterval(reassertTimer)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      if (enteredRef.current) {
        enteredRef.current = false
        void exitRendererFullscreen()
        void api?.exitAssessmentLockdown?.()
      }
    }
  }, [active])
}
