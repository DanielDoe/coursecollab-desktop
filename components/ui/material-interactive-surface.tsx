"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export const materialSurfaceClass =
  "material-surface transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"

export function useMaterialRipple(disabled?: boolean) {
  return React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return

      const host = event.currentTarget
      const rect = host.getBoundingClientRect()
      const diameter = Math.max(rect.width, rect.height) * 2.2
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const ripple = document.createElement("span")
      ripple.className = "material-ripple"
      ripple.style.width = `${diameter}px`
      ripple.style.height = `${diameter}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`

      host.appendChild(ripple)
      ripple.addEventListener(
        "animationend",
        () => {
          ripple.remove()
        },
        { once: true },
      )
    },
    [disabled],
  )
}

type MaterialInteractiveSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean
}

export function MaterialInteractiveSurface({
  className,
  children,
  disabled,
  onPointerDown,
  ...props
}: MaterialInteractiveSurfaceProps) {
  const spawnRipple = useMaterialRipple(disabled)

  return (
    <div
      className={cn(materialSurfaceClass, disabled && "opacity-70", className)}
      onPointerDown={(event) => {
        spawnRipple(event)
        onPointerDown?.(event)
      }}
      {...props}
    >
      {children}
    </div>
  )
}
