"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * M3 Card – Material Design 3 (m3.material.io/components/cards)
 * - Elevation: resting level 1, hover level 4
 * - State layer: hover 8%, pressed 12%
 * - Motion: M3 standard curve, 200ms
 */
export function MuiCard({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null)

  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty("--mouse-x", `${x}%`)
    el.style.setProperty("--mouse-y", `${y}%`)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    ref.current?.style.removeProperty("--mouse-x")
    ref.current?.style.removeProperty("--mouse-y")
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-m3-lg bg-m3-surface-container border-0 p-6",
        "transition-all duration-m3-short ease-m3-standard",
        "shadow-elevation-1 hover:shadow-elevation-4",
        "relative overflow-hidden mui-state-layer",
        "before:content-[''] before:absolute before:inset-0 before:z-[0]",
        "before:bg-[radial-gradient(600px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(99,102,241,0.08),transparent_40%)]",
        "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-m3-short before:pointer-events-none",
        "[&>*]:relative [&>*]:z-10",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  )
}
