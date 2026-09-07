"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui"

const PRESET_MINUTES = [2, 5, 10] as const
const MAX_CUSTOM_MINUTES = 30

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Drinking glass with looping drain — matches mobile FlashcardWaterBreak. */
function DrinkingGlassLoader({ size = 1, className }: { size?: number; className?: string }) {
  const glassW = 35 * size
  const glassH = 80 * size
  const liquidMaxH = glassH - 14 * size

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      style={{ width: glassW + 16 * size, height: glassH + 22 * size }}
      aria-hidden
    >
      <div
        className="absolute z-[2] rounded-sm bg-[#eb6b3e]"
        style={{
          top: 0,
          width: 4 * size,
          height: glassH * 0.55,
          borderRadius: 2 * size,
          transform: "rotate(8deg)",
        }}
      />
      <div
        className="relative overflow-hidden border-t border-b-[4px] border-[#bbb6aa] bg-[#e4e0d7] dark:border-[#9a9488] dark:bg-[#3a3732]"
        style={{
          marginTop: 18 * size,
          width: glassW,
          height: glassH,
          borderRadius: 4 * size,
          paddingLeft: 5 * size,
          paddingRight: 5 * size,
          paddingTop: 3 * size,
          paddingBottom: 3 * size,
        }}
      >
        <motion.div
          className="absolute bottom-[3px] left-[5px] right-[5px] rounded-sm bg-[#77d4d4] dark:bg-[#5ec8c8]"
          initial={{ height: liquidMaxH }}
          animate={{ height: [liquidMaxH, liquidMaxH * 0.05, liquidMaxH] }}
          transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
        />
      </div>
    </div>
  )
}

type WaterBreakDurationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (minutes: number) => void
  description?: string
  skipLabel?: string
}

const presetBtnClass = (selected: boolean) =>
  cn(
    "h-12 rounded-xl text-base font-semibold transition-colors border shadow-xs",
    selected
      ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-700"
      : "border-[var(--border)] bg-[var(--cc-modal-muted,var(--muted))]/70 text-[var(--cc-text)] hover:bg-[var(--muted)]",
  )

export function WaterBreakDurationDialog({
  open,
  onOpenChange,
  onStart,
  description = "Step away and hydrate. You can skip anytime.",
  skipLabel = "Skip break",
}: WaterBreakDurationDialogProps) {
  const [customMinutes, setCustomMinutes] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<number | "custom" | null>(null)

  useEffect(() => {
    if (!open) {
      setCustomMinutes("")
      setSelectedPreset(null)
    }
  }, [open])

  const parsedCustom = Number.parseInt(customMinutes, 10)
  const customValid =
    selectedPreset === "custom" &&
    Number.isFinite(parsedCustom) &&
    parsedCustom >= 1 &&
    parsedCustom <= MAX_CUSTOM_MINUTES

  const canStart = selectedPreset === "custom" ? customValid : selectedPreset != null

  const handleStart = () => {
    if (selectedPreset === "custom" && customValid) {
      onStart(parsedCustom)
      return
    }
    if (typeof selectedPreset === "number") {
      onStart(selectedPreset)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(CC_MODAL_SURFACE, "shadow-2xl sm:max-w-md")}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <DrinkingGlassLoader size={0.72} />
            </div>
            <div className="min-w-0 space-y-1.5 text-left">
              <DialogTitle className="text-lg font-bold">Water break</DialogTitle>
              <DialogDescription className="leading-relaxed">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 py-1">
          {PRESET_MINUTES.map((mins) => (
            <Button
              key={mins}
              type="button"
              variant="outline"
              className={presetBtnClass(selectedPreset === mins)}
              onClick={() => setSelectedPreset(mins)}
            >
              {mins} min
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className={cn("w-full rounded-xl", presetBtnClass(selectedPreset === "custom"))}
            onClick={() => setSelectedPreset("custom")}
          >
            Custom duration
          </Button>
          {selectedPreset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={MAX_CUSTOM_MINUTES}
                placeholder="Minutes"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="rounded-xl"
              />
              <span className="shrink-0 text-sm text-[var(--cc-text-muted)]">
                min (1–{MAX_CUSTOM_MINUTES})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            {skipLabel}
          </Button>
          <Button
            disabled={!canStart}
            onClick={handleStart}
            className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Start break
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type WaterBreakOverlayProps = {
  totalSeconds: number
  onResume: () => void
  resumeLabel?: string
  activeHint?: string
  completeHint?: string
  skipEarlyLabel?: string
}

export function WaterBreakOverlay({
  totalSeconds,
  onResume,
  resumeLabel = "Resume quiz",
  activeHint = "Take a breather — sip some water, stretch, breathe.",
  completeHint = "Ready to jump back in?",
  skipEarlyLabel = "Skip break and resume",
}: WaterBreakOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [complete, setComplete] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setSecondsLeft(totalSeconds)
    setComplete(false)
  }, [totalSeconds])

  useEffect(() => {
    if (complete) return
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setComplete(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [complete, totalSeconds])

  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 1

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="water-break-title"
    >
      <div
        className="absolute inset-0 bg-[var(--cc-modal-scrim,rgba(15,23,42,0.72))] backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className={cn("w-full rounded-2xl border border-[var(--border)] px-5 py-8 text-center shadow-2xl", CC_MODAL_SURFACE)}>
          <div className="flex justify-center">
            <DrinkingGlassLoader size={1.15} />
          </div>
          <h2 id="water-break-title" className="mt-5 text-xl font-bold text-[var(--cc-text)] sm:text-2xl">
            Water break
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-muted)]">
            {complete ? completeHint : activeHint}
          </p>

          <div className="mt-6 space-y-3">
            <p className="font-mono text-5xl font-bold tabular-nums tracking-tight text-[var(--cc-text)]">
              {formatCountdown(secondsLeft)}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-teal-500/20">
              <div
                className="h-full rounded-full bg-teal-600 transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--cc-text-muted)]">
              {complete ? "Break complete" : "Hydrate · stretch · reset"}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          onClick={onResume}
          className="mt-6 min-w-[220px] rounded-xl bg-teal-600 px-8 text-base font-semibold text-white hover:bg-teal-700"
        >
          {resumeLabel}
        </Button>
        {!complete ? (
          <button
            type="button"
            onClick={onResume}
            className="mt-3 text-sm text-[var(--cc-text-muted)] underline-offset-2 hover:text-[var(--cc-text)] hover:underline"
          >
            {skipEarlyLabel}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
