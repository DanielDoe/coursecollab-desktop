"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

type Props = {
  children: ReactNode
}

/** Portals workspace to body and sizes below the dashboard topbar (avoids broken top-* utilities). */
export function CoraImmersiveOverlay({ children }: Props) {
  const [mounted, setMounted] = useState(false)
  const [topbarHeight, setTopbarHeight] = useState(64)

  useEffect(() => {
    setMounted(true)
    const measure = () => {
      const topbar = document.querySelector("[data-dashboard-topbar]")
      setTopbarHeight(
        topbar instanceof HTMLElement ? Math.ceil(topbar.getBoundingClientRect().height) : 64,
      )
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-[#fafbfc] dark:bg-[var(--cc-background)]"
      style={{ top: topbarHeight }}
      role="dialog"
      aria-modal="true"
      aria-label="Cora immersive workspace"
    >
      {children}
    </div>,
    document.body,
  )
}
