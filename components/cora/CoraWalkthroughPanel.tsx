"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CORA_NAME, CORA_TAGLINE } from "@/lib/cora/constants"
import type { CoraDomain, CoraProblemContext, CoraWalkthroughResponse, CoraWalkthroughStep } from "@/lib/cora/types"
import { LectureAiMarkdown } from "@/components/lecture-ai-markdown"

const DOMAIN_STYLES: Record<
  CoraDomain,
  { badge: string; rail: string; glow: string; icon: string }
> = {
  circuit: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    rail: "from-emerald-500 to-teal-400",
    glow: "shadow-emerald-500/20",
    icon: "text-emerald-500",
  },
  coding: {
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    rail: "from-violet-500 to-indigo-500",
    glow: "shadow-violet-500/25",
    icon: "text-violet-500",
  },
  math: {
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    rail: "from-sky-500 to-cyan-400",
    glow: "shadow-sky-500/20",
    icon: "text-sky-500",
  },
  generic: {
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    rail: "from-slate-500 to-slate-400",
    glow: "shadow-slate-500/15",
    icon: "text-slate-500",
  },
}

const STEP_KIND_LABEL: Record<CoraWalkthroughStep["kind"], string> = {
  setup: "Setup",
  concept: "Concept",
  compute: "Work",
  check: "Check",
  code: "Code",
  hint: "Hint",
  summary: "Summary",
}

type Props = {
  open: boolean
  problem: CoraProblemContext | null
  onClose: () => void
}

export function CoraWalkthroughPanel({ open, problem, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walkthrough, setWalkthrough] = useState<CoraWalkthroughResponse | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [completed, setCompleted] = useState(false)

  const loadWalkthrough = useCallback(async (ctx: CoraProblemContext) => {
    setLoading(true)
    setError(null)
    setWalkthrough(null)
    setStepIndex(0)
    setShowHint(false)
    setCompleted(false)
    try {
      const res = await fetch("/api/cora/walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load walkthrough")
      setWalkthrough(data as CoraWalkthroughResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load walkthrough")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && problem) void loadWalkthrough(problem)
    if (!open) {
      setWalkthrough(null)
      setError(null)
      setStepIndex(0)
      setCompleted(false)
    }
  }, [open, problem, loadWalkthrough])

  const steps = walkthrough?.steps ?? []
  const current = steps[stepIndex]
  const domain = walkthrough?.domain ?? problem?.domain ?? "generic"
  const theme = DOMAIN_STYLES[domain]
  const progress = steps.length ? ((completed ? steps.length : stepIndex + 1) / steps.length) * 100 : 0

  const domainLabel = useMemo(() => {
    switch (domain) {
      case "circuit":
        return "Circuit walkthrough"
      case "coding":
        return "Coding walkthrough"
      case "math":
        return "Math walkthrough"
      default:
        return "Problem walkthrough"
    }
  }, [domain])

  const goNext = () => {
    setShowHint(false)
    if (stepIndex >= steps.length - 1) {
      setCompleted(true)
      return
    }
    setStepIndex((i) => i + 1)
  }

  const goPrev = () => {
    setShowHint(false)
    setCompleted(false)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-[var(--border)] bg-[var(--cc-background)] p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br", theme.rail)}>
                  <Sparkles className="h-4 w-4 text-white" />
                </span>
                <div>
                  <SheetTitle className="text-lg font-bold text-[var(--cc-text)]">{CORA_NAME}</SheetTitle>
                  <p className="text-xs text-[var(--cc-text-muted)]">{CORA_TAGLINE} · {domainLabel}</p>
                </div>
              </div>
              {problem?.title ? (
                <p className="truncate text-sm font-medium text-[var(--cc-text-secondary)]">{problem.title}</p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {!loading && steps.length > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--cc-text-muted)]">
                <span>
                  Step {completed ? steps.length : stepIndex + 1} of {steps.length}
                </span>
                <Badge variant="secondary" className={cn("text-[10px] font-semibold uppercase tracking-wide", theme.badge)}>
                  {walkthrough?.source === "reference" ? "Course solution" : "AI guided"}
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
              <Loader2 className={cn("h-10 w-10 animate-spin", theme.icon)} />
              <div className="text-center space-y-1">
                <p className="font-semibold text-[var(--cc-text)]">{CORA_NAME} is preparing your steps…</p>
                <p className="text-sm text-[var(--cc-text-muted)]">Using course materials when available</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              {problem ? (
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => void loadWalkthrough(problem)}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : completed ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center"
            >
              <CheckCircle2 className={cn("h-14 w-14", theme.icon)} />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-[var(--cc-text)]">You walked through it!</h3>
                <p className="text-sm text-[var(--cc-text-secondary)] max-w-sm">
                  Try the problem on your own, then compare with the reference if you have one.
                </p>
                {walkthrough?.finalAnswer ? (
                  <div className="mx-auto mt-4 max-w-md rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)] mb-2">
                      Expected result
                    </p>
                    <LectureAiMarkdown content={walkthrough.finalAnswer} />
                  </div>
                ) : null}
              </div>
              <Button type="button" className="rounded-xl" onClick={onClose}>
                Back to problem
              </Button>
            </motion.div>
          ) : current ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {steps.map((step, i) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        setCompleted(false)
                        setStepIndex(i)
                        setShowHint(false)
                      }}
                      className={cn(
                        "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold transition-all",
                        i === stepIndex
                          ? cn("bg-gradient-to-r text-white shadow-lg", theme.rail, theme.glow)
                          : i < stepIndex
                            ? "bg-[var(--muted)] text-[var(--cc-text-secondary)]"
                            : "border border-[var(--border)] text-[var(--cc-text-muted)]",
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className={cn(
                      "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm",
                      theme.glow,
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="outline" className="rounded-lg text-[10px] uppercase tracking-wide">
                        {STEP_KIND_LABEL[current.kind]}
                      </Badge>
                      <ChevronRight className="h-3 w-3 text-[var(--cc-text-muted)]" />
                      <h3 className="font-semibold text-[var(--cc-text)]">{current.title}</h3>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <LectureAiMarkdown content={current.body} />
                    </div>
                    <AnimatePresence>
                      {showHint && current.hint ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30"
                        >
                          <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{current.hint}</span>
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                </AnimatePresence>

                {stepIndex === 0 && problem?.questionText ? (
                  <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                      Problem
                    </p>
                    <LectureAiMarkdown content={problem.questionText} />
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--cc-background)]/95 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={stepIndex === 0}
                    onClick={goPrev}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  {current.hint ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => setShowHint((v) => !v)}
                    >
                      <Lightbulb className="mr-1 h-4 w-4" />
                      {showHint ? "Hide hint" : "I'm stuck"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className={cn("ml-auto rounded-xl bg-gradient-to-r text-white", theme.rail)}
                    onClick={goNext}
                  >
                    {stepIndex >= steps.length - 1 ? "Finish" : "Next step"}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
