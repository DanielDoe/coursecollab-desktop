"use client"

import { useEffect, useMemo, useState } from "react"
import { CoraBotMark } from "@/components/cora/CoraBotMark"
import {
  CORA_THINKING_HEADLINE,
  resolveCoraThinkingSteps,
  type CoraThinkingMode,
} from "@/lib/cora/thinking-process"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"
import { cn } from "@/lib/utils"

type Props = {
  active?: boolean
  /** CodeBench tool or tutoring goal driving the step copy */
  mode?: CoraThinkingMode
  /** @deprecated Prefer `mode` — kept for tutoring panels */
  learningGoal?: CoraLearningGoal
  showBot?: boolean
  compact?: boolean
  theme?: "light" | "dark"
  className?: string
}

export function CoraThinkingIndicator({
  active = true,
  mode,
  learningGoal = "understand",
  showBot = true,
  compact = false,
  theme = "dark",
  className,
}: Props) {
  const resolvedMode = mode ?? learningGoal
  const steps = useMemo(() => resolveCoraThinkingSteps(resolvedMode), [resolvedMode])
  const [currentStep, setCurrentStep] = useState(0)
  const isLight = theme === "light"
  const activeLabel = steps[currentStep]?.label ?? CORA_THINKING_HEADLINE[resolvedMode] ?? CORA_THINKING_HEADLINE.general

  useEffect(() => {
    if (!active) {
      setCurrentStep(0)
      return
    }
    setCurrentStep(0)
    const interval = window.setInterval(() => {
      setCurrentStep((step) => (step < steps.length - 1 ? step + 1 : step))
    }, compact ? 1400 : 1600)
    return () => window.clearInterval(interval)
  }, [active, compact, steps.length, resolvedMode])

  return (
    <div
      className={cn(
        compact ? "rounded-2xl px-3 py-2.5" : "rounded-[20px] px-3.5 py-3 sm:px-4",
        isLight ? "bg-neutral-100/90 ring-1 ring-neutral-200/80" : "bg-white/[0.06] ring-1 ring-white/[0.08]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={activeLabel}
    >
      <div className={cn("flex items-center gap-3", showBot ? "" : "justify-center")}>
        {showBot ? (
          <div className="relative shrink-0">
            <div
              className={cn(
                "pointer-events-none absolute -inset-1 rounded-full border-2 border-transparent",
                isLight
                  ? "border-t-violet-500/70 border-r-violet-300/20 animate-spin"
                  : "border-t-[#7dd3fc] border-r-violet-400/15 animate-spin",
              )}
              aria-hidden
            />
            <CoraBotMark size={compact ? "sm" : "md"} idle />
          </div>
        ) : null}

        <p
          key={`${resolvedMode}-${currentStep}`}
          className={cn(
            "cora-thinking-step-label min-w-0 flex-1 truncate font-medium",
            compact ? "text-xs" : "text-sm",
            isLight ? "text-neutral-800" : "text-neutral-100",
          )}
        >
          {activeLabel}
          <span className="cora-thinking-ellipsis" aria-hidden>
            …
          </span>
        </p>
      </div>
    </div>
  )
}
