"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Flag } from "lucide-react"
import { cn } from "@/lib/utils"

const STEP_ICONS = ["🌱", "🧠", "📊", "👁️", "📡", "⚡", "🤖", "🍓", "🎯", "🏆"]

type CampLearningJourneyTimelineProps = {
  title?: string
  steps: string[]
  /** Highlight through this index (inclusive). Defaults to last step. */
  activeThrough?: number
  /** Cycle highlight for demo / preview modes */
  animateHighlight?: boolean
  cycleMs?: number
  variant?: "vertical" | "horizontal"
  subtitle?: string
  className?: string
}

export function CampLearningJourneyTimeline({
  title = "Your Learning Journey",
  steps,
  activeThrough,
  animateHighlight = false,
  cycleMs = 2200,
  variant = "vertical",
  subtitle,
  className,
}: CampLearningJourneyTimelineProps) {
  const [cycleIndex, setCycleIndex] = useState(0)
  const resolvedActive = animateHighlight
    ? cycleIndex
    : (activeThrough ?? steps.length - 1)

  useEffect(() => {
    if (!animateHighlight || steps.length === 0) return
    const t = setInterval(() => setCycleIndex((i) => (i + 1) % steps.length), cycleMs)
    return () => clearInterval(t)
  }, [animateHighlight, cycleMs, steps.length])

  if (variant === "horizontal") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        </div>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((step, i) => {
            const isActive = i <= resolvedActive
            const isCurrent = i === resolvedActive
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="flex items-center gap-2"
              >
                <motion.span
                  layout
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    isCurrent
                      ? "bg-violet-600 text-white border-violet-500 shadow-[0_0_16px_rgba(88,44,131,0.35)]"
                      : isActive
                        ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700",
                  )}
                >
                  {step}
                </motion.span>
                {i < steps.length - 1 && (
                  <motion.span
                    className={cn(
                      "hidden sm:block w-4 h-0.5 rounded-full",
                      i < resolvedActive ? "bg-violet-400" : "bg-slate-200 dark:bg-slate-700",
                    )}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.08 + 0.1, duration: 0.4 }}
                  />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-transparent to-indigo-500/[0.05] p-4 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {title}
          </p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0 rounded-full bg-violet-500/10 p-2"
        >
          <Flag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </motion.div>
      </div>

      <div className="relative pl-6 sm:pl-8">
        <motion.div
          className="absolute left-[11px] sm:left-[15px] top-2 bottom-2 w-0.5 rounded-full bg-slate-200 dark:bg-white/10 origin-top"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="absolute left-[11px] sm:left-[15px] top-2 w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-emerald-400 origin-top"
          initial={{ scaleY: 0 }}
          animate={{
            scaleY: steps.length > 1 ? resolvedActive / (steps.length - 1) : 1,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "calc(100% - 8px)" }}
        />

        <div className="space-y-4 sm:space-y-5">
          {steps.map((step, i) => {
            const isDone = i < resolvedActive
            const isCurrent = i === resolvedActive
            const isUpcoming = i > resolvedActive
            const icon = STEP_ICONS[i % STEP_ICONS.length]

            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
                className="relative flex items-start gap-3"
              >
                <motion.span
                  className={cn(
                    "absolute -left-6 sm:-left-8 top-0.5 flex size-6 sm:size-7 items-center justify-center rounded-full border-2 text-[10px] sm:text-xs z-10",
                    isCurrent &&
                      "border-violet-500 bg-violet-500 text-white shadow-[0_0_20px_rgba(88,44,131,0.45)]",
                    isDone && "border-emerald-500 bg-emerald-500 text-white",
                    isUpcoming && "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-400",
                  )}
                  animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  {isDone ? "✓" : icon}
                </motion.span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "text-sm sm:text-base font-medium transition-colors",
                      isCurrent && "text-violet-700 dark:text-violet-300",
                      isDone && "text-emerald-700 dark:text-emerald-400",
                      isUpcoming && "text-slate-500 dark:text-slate-400",
                    )}
                  >
                    {step}
                  </p>
                  <AnimatePresence>
                    {isCurrent && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5"
                      >
                        {i === steps.length - 1 ? "Your destination" : "Up next on your path"}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {resolvedActive === steps.length - 1 && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.07 + 0.2 }}
          className="text-sm text-center text-violet-700 dark:text-violet-300 mt-6 font-medium"
        >
          You are on track to showcase your Edge AI system.
        </motion.p>
      )}
    </div>
  )
}
