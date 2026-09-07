"use client"

import { useCallback, useEffect, useState } from "react"

const PREFIX = "cc-dismiss:"

export function useDismissibleBanner(
  storageKey: string,
  options?: { autoDismissMs?: number },
): {
  visible: boolean
  dismiss: () => void
} {
  const [visible, setVisible] = useState(true)
  const autoDismissMs = options?.autoDismissMs

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(`${PREFIX}${storageKey}`) !== "1")
    } catch {
      setVisible(true)
    }
  }, [storageKey])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(`${PREFIX}${storageKey}`, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }, [storageKey])

  useEffect(() => {
    if (!visible || autoDismissMs == null || autoDismissMs <= 0) return
    const timer = window.setTimeout(dismiss, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [visible, autoDismissMs, dismiss])

  return { visible, dismiss }
}
