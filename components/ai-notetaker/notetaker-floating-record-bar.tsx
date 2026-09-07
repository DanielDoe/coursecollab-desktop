"use client"

import { Mic, Pause, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NotetakerFloatingRecordBarProps = {
  recording: boolean
  paused: boolean
  seconds: number
  maxSeconds: number
  supportsPause: boolean
  onPauseToggle: () => void
  onStop: () => void
  stopLabel?: string
  /** 0–1 RMS mic level from the recorder stream; drives the mic halo while recording. */
  micLevel?: number
  className?: string
}

export function NotetakerFloatingRecordBar({
  recording,
  paused,
  seconds,
  maxSeconds,
  supportsPause,
  onPauseToggle,
  onStop,
  stopLabel = "Stop",
  micLevel,
  className,
}: NotetakerFloatingRecordBarProps) {
  if (!recording) return null

  const pct = Math.min(100, maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0)
  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, "0")
  const level = typeof micLevel === "number" ? Math.min(1, Math.max(0, micLevel)) : 0
  const micHot = !paused && level > 0.035

  return (
    <div
      className={cn(
        "pointer-events-auto sticky bottom-3 z-30 mx-auto flex w-full max-w-xl justify-center px-1 sm:bottom-5",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-[999px] border border-slate-200/90 bg-white/[0.97] px-2.5 py-2 shadow-[0_16px_56px_rgba(15,23,42,0.14),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-2xl sm:gap-3 sm:px-4 sm:py-2.5",
          "dark:border-slate-600/80 dark:bg-slate-950/90 dark:shadow-[0_16px_56px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        )}
      >
        {supportsPause ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-slate-700 hover:bg-slate-100/90 dark:text-slate-200 dark:hover:bg-slate-800/90"
            onClick={onPauseToggle}
            aria-label={paused ? "Resume recording" : "Pause recording"}
          >
            {paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5" />}
          </Button>
        ) : (
          <span className="w-1 shrink-0" aria-hidden />
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-red-600 hover:bg-red-50/90 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={onStop}
          aria-label={stopLabel}
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>

        {typeof micLevel === "number" ? (
          <div
            className="relative flex h-10 w-10 shrink-0 items-center justify-center"
            title="Microphone input level"
            aria-label={`Microphone input about ${Math.round(level * 100)} percent`}
          >
            {!paused && (
              <>
                <span
                  className="pointer-events-none absolute inset-[-6px] rounded-full bg-emerald-400/50 blur-lg transition-[opacity,transform] duration-150 ease-out"
                  style={{
                    opacity: 0.12 + level * 0.78,
                    transform: `scale(${1 + level * 0.45})`,
                  }}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-full border-2 transition-colors duration-150",
                    micHot ? "border-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.45)]" : "border-emerald-500/25",
                  )}
                  style={{ opacity: 0.25 + level * 0.55 }}
                />
              </>
            )}
            <Mic
              className={cn(
                "relative z-[1] h-[18px] w-[18px] transition-colors duration-150",
                paused ? "text-slate-400 dark:text-slate-500" : "text-emerald-600 dark:text-emerald-400",
              )}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!paused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-55" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80",
                paused ? "bg-amber-500" : "bg-red-500",
              )}
            />
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/95 dark:bg-slate-700/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums tracking-tight text-slate-700 dark:text-slate-200 sm:text-xs">
            {mm}:{ss}
          </span>
        </div>
      </div>
    </div>
  )
}
