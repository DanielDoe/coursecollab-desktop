"use client"

import * as SliderPrimitive from "@radix-ui/react-slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const CATEGORY_META: Record<string, { label: string; bar: string }> = {
  quiz: { label: "Quiz", bar: "bg-[var(--cc-accent)]" },
  homework: { label: "Homework", bar: "bg-[var(--cc-accent)]/85" },
  midterm: { label: "Midterm", bar: "bg-[var(--cc-accent)]/70" },
  final: { label: "Final", bar: "bg-[var(--cc-accent-dark)]" },
  attendance: { label: "Attendance", bar: "bg-[var(--cc-accent)]/55" },
  project: { label: "Project", bar: "bg-[var(--cc-accent-dark)]/80" },
  classroom: { label: "Classroom", bar: "bg-[var(--cc-accent)]/45" },
  engagement: { label: "Engagement", bar: "bg-[var(--cc-accent)]/35" },
}

export const GRADE_WEIGHT_KEYS = Object.keys(CATEGORY_META)

const FIELD = cn(
  "h-8 w-14 rounded-lg border text-center text-sm font-semibold tabular-nums shadow-none sm:w-16",
  CC_FIELD.base,
  CC_FIELD.focus,
)

export function GradeWeightDistributionBar({
  weights,
  total,
  portal = false,
}: {
  weights: Record<string, number>
  total: number
  portal?: boolean
}) {
  if (total <= 0) {
    return (
      <div
        className={cn(
          "h-2.5 overflow-hidden rounded-full",
          portal ? "bg-[var(--sidebar-accent)]/20" : "bg-slate-100 dark:bg-white/10",
        )}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={cn(
        "flex h-2.5 overflow-hidden rounded-full ring-1 ring-inset",
        portal
          ? "bg-[var(--sidebar-accent)]/15 ring-[var(--border)]"
          : "bg-slate-100/80 ring-slate-200/60 dark:bg-white/[0.06] dark:ring-white/[0.08]",
      )}
      aria-hidden
    >
      {GRADE_WEIGHT_KEYS.map((key) => {
        const pct = (weights[key] / total) * 100
        if (pct <= 0) return null
        const meta = CATEGORY_META[key]
        return (
          <div
            key={key}
            className={cn("h-full transition-all duration-300", meta.bar)}
            style={{ width: `${pct}%` }}
            title={`${meta.label} ${weights[key]}%`}
          />
        )
      })}
    </div>
  )
}

type GradeWeightSliderRowProps = {
  keyName: string
  label: string
  value: number
  shareOfTotal: number
  onChange: (value: number) => void
  portal?: boolean
  sliderClass?: string
}

export function GradeWeightSliderRow({
  keyName,
  label,
  value,
  shareOfTotal,
  onChange,
  portal = false,
  sliderClass,
}: GradeWeightSliderRowProps) {
  const meta = CATEGORY_META[keyName] ?? CATEGORY_META.quiz
  const clamp = (n: number) => Math.max(0, Math.min(100, n))

  const handleInput = (raw: string) => {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n)) onChange(clamp(n))
    else if (raw === "") onChange(0)
  }

  if (portal) {
    return (
      <div className="space-y-2.5 rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn("size-2 shrink-0 rounded-full", meta.bar)} aria-hidden />
            <div className="min-w-0">
              <Label htmlFor={`weight-${keyName}`} className={cn("text-sm font-medium", PORTAL_TEXT)}>
                {label}
              </Label>
              {shareOfTotal > 0 ? (
                <p className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
                  {shareOfTotal.toFixed(0)}% of course mix
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Input
              id={`weight-${keyName}`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => handleInput(e.target.value)}
              className={FIELD}
            />
            <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>%</span>
          </div>
        </div>
        <SliderPrimitive.Root
          value={[value]}
          onValueChange={([v]) => onChange(clamp(v ?? 0))}
          min={0}
          max={100}
          step={1}
          className={cn("relative flex w-full touch-none items-center select-none py-0.5", sliderClass)}
          aria-label={`${label} weight`}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[var(--muted)]">
            <SliderPrimitive.Range className={cn("absolute h-full rounded-full", meta.bar)} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block size-4 shrink-0 cursor-grab rounded-full border-2 border-[var(--card)] bg-[var(--cc-accent)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent-border)] active:cursor-grabbing" />
        </SliderPrimitive.Root>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group rounded-xl border p-3 sm:p-4 transition-colors",
        "border-slate-200/70 dark:border-white/[0.08]",
        "bg-white/50 dark:bg-white/[0.02]",
        "hover:border-slate-300/80 dark:hover:border-white/[0.12]",
        "hover:bg-white/80 dark:hover:bg-white/[0.04]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("size-2.5 shrink-0 rounded-full", meta.bar)} aria-hidden />
          <Label htmlFor={`weight-${keyName}`} className="truncate font-medium text-slate-800 dark:text-slate-100">
            {label}
          </Label>
          {shareOfTotal > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400 sm:text-xs dark:text-slate-500">
              {shareOfTotal.toFixed(0)}% of mix
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Input
            id={`weight-${keyName}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => handleInput(e.target.value)}
            className="h-8 w-14 rounded-lg border border-slate-200/80 bg-white/90 text-center text-sm font-semibold tabular-nums sm:w-16 dark:border-white/[0.1] dark:bg-white/[0.06]"
          />
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">%</span>
        </div>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([v]) => onChange(clamp(v ?? 0))}
        min={0}
        max={100}
        step={1}
        className="relative flex w-full touch-none items-center select-none py-1"
        aria-label={`${label} weight`}
      >
        <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-slate-300/40 dark:bg-white/[0.08] dark:ring-white/[0.06]">
          <SliderPrimitive.Range className={cn("absolute h-full rounded-full", meta.bar)} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-5 shrink-0 cursor-grab rounded-full border-2 border-white bg-white shadow-md ring-2 ring-slate-900/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 active:cursor-grabbing dark:border-slate-200 dark:bg-slate-100 dark:ring-white/20" />
      </SliderPrimitive.Root>
    </div>
  )
}
