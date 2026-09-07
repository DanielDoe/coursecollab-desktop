"use client"

import { useCallback, useEffect, useState, type ReactNode, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight, Grid2X2, Maximize2, Minimize2, X } from "lucide-react"
import { PitchFocusProvider, usePitchFocus } from "@/components/pitch/pitch-focus"
import { PitchOverview } from "@/components/pitch/pitch-overview"
import { PitchSlide, SLIDE_TITLES } from "@/components/pitch/slides"
import { cn } from "@/lib/utils"
import "@/components/pitch/pitch-motion.css"

const LAST = SLIDE_TITLES.length - 1

function parseHash(): number | null {
  const raw = window.location.hash.replace("#", "")
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > SLIDE_TITLES.length) return null
  return n - 1
}

export function PitchDeck() {
  return (
    <PitchFocusProvider>
      <PitchDeckInner />
    </PitchFocusProvider>
  )
}

function PitchDeckInner() {
  const [index, setIndex] = useState(0)
  const [overview, setOverview] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const chrome = true
  const focus = usePitchFocus()

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(LAST, next))
    setIndex(clamped)
    setOverview(false)
    window.history.replaceState(null, "", `#${clamped + 1}`)
  }, [])

  useEffect(() => {
    const syncHash = () => {
      const fromHash = parseHash()
      if (fromHash != null) setIndex(fromHash)
    }
    syncHash()
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return

      if (e.key === "g" || e.key === "G" || e.key === "o" || e.key === "O") {
        e.preventDefault()
        setOverview((v) => !v)
        return
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        void toggleFullscreen()
        return
      }
      if (e.key === "Escape") {
        if (overview) {
          setOverview(false)
          return
        }
        if (focus?.consume(e)) {
          e.preventDefault()
          return
        }
        go(0)
        return
      }
      if (focus?.consume(e)) {
        e.preventDefault()
        return
      }
      if (e.key === "Home") {
        e.preventDefault()
        go(0)
        return
      }
      if (e.key === "End") {
        e.preventDefault()
        go(LAST)
        return
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault()
        if (index < LAST) go(index + 1)
        return
      }
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [focus, go, index, overview])

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  return (
    <div
      className="relative isolate h-[100dvh] overflow-hidden bg-[#09060f] text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={(e) => onTouchEnd(e, index, go)}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#582c83]/45 blur-[120px]" />
        <div className="absolute -bottom-28 -left-16 h-[22rem] w-[22rem] rounded-full bg-[#EAAA00]/10 blur-[110px]" />
      </div>

      <div
        className="absolute left-0 top-0 z-20 h-0.5 bg-[#EAAA00] transition-[width] duration-300"
        style={{ width: `${((index + 1) / SLIDE_TITLES.length) * 100}%` }}
      />

      <div className="relative h-full">
        <div
          key={index}
          className="pitch-enter absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain"
          onClick={(e) => {
            if (index >= LAST) return
            if ((e.target as HTMLElement).closest("a,button")) return
            const rect = e.currentTarget.getBoundingClientRect()
            go(index + (e.clientX - rect.left > rect.width * 0.32 ? 1 : -1))
          }}
        >
          <PitchSlide index={index} />
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 transition-opacity duration-300 sm:px-6 sm:pt-10",
          chrome || overview ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="pointer-events-none min-w-0 truncate text-[10px] tracking-[0.14em] text-white/35 sm:text-[11px] sm:tracking-[0.18em]">
          {String(index + 1).padStart(2, "0")} / {String(SLIDE_TITLES.length).padStart(2, "0")}
          <span className="ml-2 hidden text-white/25 sm:ml-3 md:inline">{SLIDE_TITLES[index]}</span>
        </p>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <ChromeBtn
            label="Overview"
            onClick={() => setOverview((v) => !v)}
          >
            {overview ? <X className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
          </ChromeBtn>
          <ChromeBtn label="Previous" onClick={() => go(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </ChromeBtn>
          <ChromeBtn label="Next" onClick={() => go(index + 1)}>
            <ChevronRight className="h-4 w-4" />
          </ChromeBtn>
          <ChromeBtn
            label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={() => void toggleFullscreen()}
            className="hidden sm:inline-flex"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ChromeBtn>
        </div>
      </div>

      {overview ? (
        <PitchOverview index={index} onPick={go} onClose={() => setOverview(false)} />
      ) : null}
    </div>
  )
}

function ChromeBtn({
  children,
  onClick,
  label,
  className,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/80 backdrop-blur-sm hover:bg-white/10 sm:h-9 sm:w-9",
        className,
      )}
    >
      {children}
    </button>
  )
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      }
      return
    }
    const el = document.documentElement
    if (!el.requestFullscreen) return
    await el.requestFullscreen()
  } catch {
    // iOS Safari and some embedded browsers lack Fullscreen API — ignore.
  }
}

let touchX = 0

function onTouchStart(e: TouchEvent) {
  touchX = e.changedTouches[0]?.clientX ?? 0
}

function onTouchEnd(e: TouchEvent, index: number, go: (n: number) => void) {
  const x = e.changedTouches[0]?.clientX ?? touchX
  const dx = x - touchX
  if (Math.abs(dx) < 56) return
  if (dx < 0 && index >= LAST) return
  go(index + (dx < 0 ? 1 : -1))
}
