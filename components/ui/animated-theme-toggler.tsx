"use client"

import {
  useCallback,
  useRef,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

type ThemeName = "light" | "dark"

export type ThemeRevealOptions = {
  duration?: number
  fromCenter?: boolean
  origin?: Pick<DOMRect, "top" | "left" | "width" | "height"> | null
  /** Destination theme after toggle — used for overlay bookkeeping. */
  nextTheme: ThemeName
  applyTheme: () => void
}

let isRevealing = false

function resolveOriginPoint(
  fromCenter: boolean,
  origin: ThemeRevealOptions["origin"],
): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (fromCenter || !origin) {
    return { x: vw / 2, y: vh / 2 }
  }
  return {
    x: origin.left + origin.width / 2,
    y: origin.top + origin.height / 2,
  }
}

/**
 * Smooth light/dark reveal:
 * 1) Cover the viewport with the *current* theme color
 * 2) Apply the new theme underneath (hidden by the overlay)
 * 3) Shrink the overlay away from the click point
 *
 * Avoids the glitchy “apply + fade” flash from expanding a destination-color mask.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const {
    duration = 420,
    fromCenter = false,
    origin = null,
    nextTheme,
    applyTheme,
  } = options

  if (typeof document === "undefined") {
    applyTheme()
    return
  }

  if (isRevealing) return

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  if (reducedMotion) {
    applyTheme()
    return
  }

  const currentTheme: ThemeName = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"
  const { x, y } = resolveOriginPoint(fromCenter, origin)
  const overlay = document.createElement("div")
  overlay.className = "cc-theme-reveal cc-theme-reveal--cover"
  overlay.setAttribute("aria-hidden", "true")
  overlay.style.setProperty("--cc-theme-reveal-x", `${x}px`)
  overlay.style.setProperty("--cc-theme-reveal-y", `${y}px`)
  overlay.style.setProperty("--cc-theme-reveal-ms", `${duration}ms`)
  overlay.dataset.theme = currentTheme

  isRevealing = true
  let finished = false
  document.body.appendChild(overlay)

  const cleanup = () => {
    if (finished) return
    finished = true
    overlay.removeEventListener("transitionend", onShrinkEnd)
    overlay.remove()
    isRevealing = false
  }

  const onShrinkEnd = (event: TransitionEvent) => {
    if (event.target !== overlay) return
    if (event.propertyName !== "clip-path") return
    cleanup()
  }

  // Two rAFs: paint full cover, apply theme under it, then shrink.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        applyTheme()
      } catch {
        cleanup()
        return
      }
      overlay.addEventListener("transitionend", onShrinkEnd)
      overlay.classList.remove("cc-theme-reveal--cover")
      overlay.classList.add("cc-theme-reveal--shrink")
      window.setTimeout(cleanup, duration + 120)
    })
  })
}

/** @deprecated Alias — prefer runThemeReveal */
export const runThemeViewTransition = (
  options: Omit<ThemeRevealOptions, "nextTheme"> & {
    nextTheme?: ThemeName
    applyTheme: () => void
  },
) => {
  const nextTheme =
    options.nextTheme ??
    (document.documentElement.classList.contains("dark") ? "light" : "dark")
  runThemeReveal({ ...options, nextTheme })
}

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  duration?: number
  fromCenter?: boolean
  theme: ThemeName
  onThemeChange: (theme: ThemeName) => void
  children: ReactNode
}

/** Theme toggle button — keeps your icons; runs the custom circle reveal. */
export function AnimatedThemeToggler({
  className,
  duration = 420,
  fromCenter = false,
  theme,
  onThemeChange,
  children,
  onClick,
  ...props
}: AnimatedThemeTogglerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  const toggleTheme = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return

      const next: ThemeName = theme === "dark" ? "light" : "dark"
      const rect = buttonRef.current?.getBoundingClientRect() ?? null

      runThemeReveal({
        duration,
        fromCenter,
        origin: rect,
        nextTheme: next,
        // Sync class before React paints so the shrink reveals the new theme.
        applyTheme: () => {
          document.documentElement.classList.toggle("dark", next === "dark")
          onThemeChange(next)
        },
      })
    },
    [duration, fromCenter, theme, onThemeChange, onClick],
  )

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}
