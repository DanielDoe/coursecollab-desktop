"use client"

import { SLIDE_TITLES } from "@/components/pitch/slides"
import { cn } from "@/lib/utils"

export function PitchOverview({
  index,
  onPick,
  onClose,
}: {
  index: number
  onPick: (i: number) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-40 overflow-y-auto overscroll-y-contain bg-[#09060f]/95 backdrop-blur-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
              Jump to slide
            </h2>
            <p className="mt-0.5 text-sm text-white/45">
              {index + 1} of {SLIDE_TITLES.length} · {SLIDE_TITLES[index]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            Close
          </button>
        </header>

        <ul className="divide-y divide-white/8 rounded-xl border border-white/10 bg-white/[0.02]">
          {SLIDE_TITLES.map((title, slideIdx) => {
            const active = slideIdx === index
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => onPick(slideIdx)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition sm:px-5 sm:py-3.5",
                    active
                      ? "bg-[#EAAA00]/10 text-white"
                      : "text-white/80 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-sans text-sm font-bold tabular-nums",
                      active ? "bg-[#EAAA00] text-[#1e1033]" : "bg-white/5 text-[#EAAA00]/80",
                    )}
                  >
                    {slideIdx + 1}
                  </span>
                  <span className={cn("min-w-0 text-sm font-medium sm:text-[15px]", active && "font-semibold")}>
                    {title}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-center text-xs text-white/30">
          Press <kbd className="rounded border border-white/15 px-1 font-mono">G</kbd> to close
        </p>
      </div>
    </div>
  )
}
