"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, Brain, Check, Loader2, PenLine, Puzzle, Rocket, Search, Sparkles, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"

type ThinkingStep = {
  id: string
  label: string
  icon: typeof BookOpen
}

const GOAL_STEPS: Record<CoraLearningGoal, ThinkingStep[]> = {
  understand: [
    { id: "context", label: "Reading your course context", icon: BookOpen },
    { id: "simplify", label: "Building a clear explanation", icon: Brain },
    { id: "check", label: "Preparing a comprehension check", icon: PenLine },
  ],
  solve_together: [
    { id: "analyze", label: "Analyzing the problem", icon: Puzzle },
    { id: "plan", label: "Breaking into guided steps", icon: Brain },
    { id: "hint", label: "Crafting your first hint", icon: PenLine },
  ],
  review: [
    { id: "read", label: "Reviewing your submission", icon: Search },
    { id: "gaps", label: "Identifying improvements", icon: Brain },
    { id: "feedback", label: "Writing constructive feedback", icon: PenLine },
  ],
  prepare: [
    { id: "scope", label: "Scoping what to prepare for", icon: Target },
    { id: "weak", label: "Finding weak spots", icon: Brain },
    { id: "plan", label: "Building your practice plan", icon: PenLine },
  ],
  create: [
    { id: "format", label: "Choosing the best format", icon: Rocket },
    { id: "outline", label: "Outlining your resource", icon: Brain },
    { id: "draft", label: "Drafting content", icon: PenLine },
  ],
}

type Props = {
  active?: boolean
  learningGoal?: CoraLearningGoal
}

export function CoraThinkingIndicator({
  active = true,
  learningGoal = "understand",
}: Props) {
  const steps = useMemo(() => GOAL_STEPS[learningGoal] ?? GOAL_STEPS.understand, [learningGoal])
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!active) {
      setCurrentStep(0)
      return
    }
    setCurrentStep(0)
    const interval = window.setInterval(() => {
      setCurrentStep((s) => (s < steps.length - 1 ? s + 1 : s))
    }, 1100)
    return () => window.clearInterval(interval)
  }, [active, steps.length])

  return (
    <div className="rounded-[24px] bg-neutral-100/90 px-5 py-4 dark:bg-white/[0.06]">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
        <Sparkles className="h-4 w-4 text-violet-500" />
        Working on it…
      </p>
      <ul className="relative space-y-0">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isDone = idx < currentStep
          const isActive = idx === currentStep
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {idx < steps.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[11px] top-6 h-[calc(100%-12px)] w-px",
                    isDone ? "bg-violet-400/60" : "bg-neutral-200 dark:bg-white/10",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  isDone && "bg-violet-500 text-white",
                  isActive && "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
                  !isDone && !isActive && "bg-neutral-200/80 text-neutral-400 dark:bg-white/[0.08]",
                )}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={cn(
                  "pt-0.5 text-sm",
                  isActive ? "font-medium text-neutral-800 dark:text-neutral-100" : "text-neutral-500",
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
