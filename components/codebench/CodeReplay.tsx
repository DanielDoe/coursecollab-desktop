"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from "framer-motion"
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Terminal,
  Lightbulb,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CodeReplayStep } from "@/lib/codebench-replay"
import {
  REPLAY_PACE_MODES,
  computeAutoAdvanceMs,
  getBulletsForMode,
  getDeepInsight,
  getExplanationForMode,
  normalizePaceMode,
  type ReplayModeConfig,
  type ReplayPaceMode,
} from "@/lib/codebench-replay-modes"
import { loadReplayProgress, saveReplayProgress } from "@/lib/codebench-ai-cache"

const PHASE_COLORS_DARK: Record<string, string> = {
  setup: "bg-sky-500/20 text-sky-200 border-sky-500/30",
  loop: "bg-violet-500/20 text-violet-200 border-violet-500/30",
  condition: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  body: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  update: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30",
  output: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30",
  return: "bg-slate-500/20 text-slate-200 border-slate-500/30",
}

const PHASE_COLORS_LIGHT: Record<string, string> = {
  setup: "bg-sky-100 text-sky-800 border-sky-300",
  loop: "bg-violet-100 text-violet-800 border-violet-300",
  condition: "bg-amber-100 text-amber-900 border-amber-300",
  body: "bg-emerald-100 text-emerald-800 border-emerald-300",
  update: "bg-indigo-100 text-indigo-800 border-indigo-300",
  output: "bg-cyan-100 text-cyan-900 border-cyan-300",
  return: "bg-slate-100 text-slate-700 border-slate-300",
}

function replayTheme(isLight: boolean) {
  return {
    phase: isLight ? PHASE_COLORS_LIGHT : PHASE_COLORS_DARK,
    root: isLight ? "bg-white" : "bg-[#080b10]",
    header: isLight ? "border-slate-200 bg-white/95" : "border-[#582c83]/25 bg-[#0d1118]/95",
    title: isLight ? "text-violet-700" : "text-violet-200",
    stepBadge: isLight ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-400",
    progressTrack: isLight ? "bg-slate-200" : "bg-slate-800/80",
    muted: isLight ? "text-slate-500" : "text-slate-400",
    hint: isLight ? "text-slate-500" : "text-slate-500",
    select: isLight
      ? "border-slate-300 bg-white text-slate-700"
      : "border-slate-600 bg-slate-800 text-slate-300",
    outlineBtn: isLight ? "border-slate-300 text-slate-700" : "border-slate-600 text-slate-200",
    fullTextBtn: isLight
      ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
      : "border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
    timeline: isLight ? "border-violet-100 bg-violet-50/40" : "border-[#582c83]/20 bg-[#0a0e14]/90",
    timelineLineDone: isLight ? "bg-violet-400" : "bg-violet-500/70",
    timelineLinePending: isLight ? "bg-violet-100" : "bg-slate-700/80",
    timelineDotDone: isLight
      ? "bg-violet-100 text-violet-600 ring-2 ring-violet-300/80"
      : "bg-violet-500/15 text-violet-300 ring-2 ring-violet-500/35",
    timelineDotActive: isLight
      ? "bg-violet-600 text-white shadow-md shadow-violet-300/40 ring-4 ring-violet-200/80"
      : "bg-violet-600 text-white shadow-lg shadow-violet-900/50 ring-4 ring-violet-500/20",
    timelineDotPending: isLight
      ? "border-2 border-violet-200 bg-white text-slate-400"
      : "border-2 border-slate-600 bg-transparent text-slate-500",
    timelineRowActive: isLight ? "bg-violet-100/70" : "bg-violet-500/10",
    timelineRowHover: isLight ? "hover:bg-violet-50" : "hover:bg-violet-500/5",
    timelineTitle: isLight ? "text-slate-600" : "text-slate-400",
    timelineTitleDone: isLight ? "text-violet-700" : "text-violet-300/90",
    timelineTitleActive: isLight ? "text-violet-900" : "text-violet-100",
    timelineMeta: isLight ? "text-slate-400" : "text-slate-600",
    timelineMetaActive: isLight ? "text-violet-500" : "text-violet-400/80",
    heading: isLight ? "text-slate-900" : "text-white",
    codeWindow: isLight
      ? "border-slate-200 bg-slate-50 shadow-inner shadow-slate-200/60"
      : "border-slate-700/80 bg-[#0c0f16] shadow-inner shadow-black/40",
    codeLine: isLight ? "text-slate-600" : "text-slate-400",
    codeLineActive: isLight ? "text-violet-900" : "text-violet-100",
    codeNum: isLight ? "text-slate-400" : "text-slate-600",
    codeNumActive: isLight ? "text-violet-600" : "text-violet-400",
    codeActiveBg: isLight ? "rgba(139, 92, 246, 0.12)" : "rgba(139, 92, 246, 0.22)",
    nowBadge: isLight ? "bg-violet-200 text-violet-800" : "bg-violet-500/30 text-violet-200",
    conditionBox: isLight ? "border-slate-200 bg-white" : "border-slate-700/60 bg-slate-800/40",
    conditionLabel: isLight ? "text-slate-500" : "text-slate-500",
    conditionText: isLight ? "text-slate-800" : "text-slate-200",
    conditionTrue: isLight ? "text-emerald-700" : "text-emerald-400",
    conditionFalse: isLight ? "text-rose-700" : "text-rose-400",
    memoryLabel: isLight ? "text-slate-500" : "text-slate-500",
    explainBox: isLight
      ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white"
      : "border-violet-500/25 bg-gradient-to-br from-violet-950/50 to-[#0c0f16]",
    explainLabel: isLight ? "text-violet-700" : "text-violet-300",
    bodyText: isLight ? "text-slate-700" : "text-slate-200",
    bulletText: isLight ? "text-slate-600" : "text-slate-300",
    bulletDivider: isLight ? "border-violet-200" : "border-violet-500/15",
    tipBox: isLight ? "border-amber-300 bg-amber-50" : "border-amber-500/25 bg-amber-500/5",
    tipText: isLight ? "text-slate-700" : "text-slate-300",
    deepBox: isLight
      ? "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"
      : "border-indigo-400/30 bg-gradient-to-br from-indigo-950/50 to-[#0c0f16]",
    deepLabel: isLight ? "text-indigo-700" : "text-indigo-300",
    consoleBox: isLight ? "border-cyan-300 bg-slate-900" : "border-cyan-500/30 bg-black/70",
    consoleHeader: isLight ? "border-cyan-800 bg-cyan-950/80" : "border-cyan-500/20 bg-cyan-950/40",
    conceptBadge: isLight ? "border-slate-300 text-slate-600" : "border-slate-600 text-slate-400",
    summaryBadge: isLight ? "border-slate-300 text-slate-500" : "border-slate-600 text-slate-500",
    varCard: isLight ? "border-slate-200 bg-white" : "border-slate-700/60 bg-slate-800/40",
    varCardChanged: isLight
      ? "border-emerald-400 bg-emerald-50 shadow-emerald-200/40"
      : "border-emerald-400/50 bg-emerald-500/15 shadow-emerald-500/10",
    varLabel: isLight ? "text-slate-700" : "text-slate-300",
    varValue: isLight ? "text-slate-900" : "text-slate-100",
    varValueChanged: isLight ? "text-emerald-800" : "text-emerald-200",
    varPrev: isLight ? "text-slate-400" : "text-slate-500",
    varChangedHint: isLight ? "text-emerald-700" : "text-emerald-300",
    varChangedDot: isLight ? "bg-emerald-600" : "bg-emerald-400",
    dotIdle: isLight ? "bg-violet-100" : "bg-slate-700/80",
    dotDone: isLight ? "bg-violet-400/80" : "bg-violet-500/60",
  }
}

function buildMotion(mode: ReplayModeConfig) {
  const ease = [0.22, 1, 0.36, 1] as const
  const stagger: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: mode.staggerChildren, delayChildren: mode.delayChildren },
    },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: mode.itemDuration, ease },
    },
  }
  const slide = (reducedMotion: boolean, direction: number): Variants => ({
    enter: {
      opacity: 0,
      x: reducedMotion ? 0 : direction > 0 ? 40 : -40,
      scale: reducedMotion ? 1 : 0.97,
      filter: reducedMotion ? "blur(0px)" : "blur(6px)",
    },
    center: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
    exit: {
      opacity: 0,
      x: reducedMotion ? 0 : direction > 0 ? -28 : 28,
      scale: reducedMotion ? 1 : 0.98,
      filter: reducedMotion ? "blur(0px)" : "blur(4px)",
    },
  })
  const slideTransition: Transition = { duration: mode.slideDuration, ease }
  return { stagger, item, slide, slideTransition, ease }
}

function AnimatedSentences({
  text,
  reducedMotion,
  motionItem,
  bodyClass,
}: {
  text: string
  reducedMotion: boolean
  motionItem: Variants
  bodyClass: string
}) {
  const parts = useMemo(() => text.split(/(?<=[.!?])\s+/).filter(Boolean), [text])
  if (reducedMotion) return <p className={cn("text-sm leading-relaxed", bodyClass)}>{text}</p>
  return (
    <div className="space-y-2">
      {parts.map((sentence, i) => (
        <motion.p key={`${i}-${sentence.slice(0, 24)}`} variants={motionItem} className={cn("text-sm leading-relaxed", bodyClass)}>
          {sentence}
        </motion.p>
      ))}
    </div>
  )
}

function VariableCard({
  name,
  value,
  changed,
  prevValue,
  reducedMotion,
  motionItem,
  itemDuration,
  theme,
}: {
  name: string
  value: string | number | boolean
  changed: boolean
  prevValue?: string | number | boolean
  reducedMotion: boolean
  motionItem: Variants
  itemDuration: number
  theme: ReturnType<typeof replayTheme>
}) {
  return (
    <motion.div
      layout
      variants={motionItem}
      animate={
        changed && !reducedMotion
          ? {
              scale: [1, 1.06, 1],
              boxShadow: [
                "0 0 0 rgba(52, 211, 153, 0)",
                "0 0 24px rgba(52, 211, 153, 0.35)",
                "0 0 0 rgba(52, 211, 153, 0)",
              ],
            }
          : undefined
      }
      transition={{ duration: itemDuration * 1.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1",
        changed ? theme.varCardChanged : theme.varCard,
      )}
    >
      {changed ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/15 to-emerald-400/0"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: itemDuration * 2, ease: "easeOut" }}
        />
      ) : null}
      <span className={cn("relative shrink-0 font-mono text-xs font-semibold", theme.varLabel)}>{name}</span>
      <span className={cn("relative shrink-0 font-mono text-xs", theme.varPrev)} aria-hidden>
        =
      </span>
      <div className="relative flex items-center gap-1">
        {changed && prevValue !== undefined ? (
          <motion.span
            initial={{ opacity: 0.7, x: 0 }}
            animate={{ opacity: 0, x: -4 }}
            transition={{ duration: itemDuration }}
            className={cn("font-mono text-xs line-through", theme.varPrev)}
          >
            {String(prevValue)}
          </motion.span>
        ) : null}
        <AnimatePresence mode="wait">
          <motion.span
            key={String(value)}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: itemDuration }}
            className={cn("font-mono text-xs font-bold tabular-nums", changed ? theme.varValueChanged : theme.varValue)}
          >
            {String(value)}
          </motion.span>
        </AnimatePresence>
      </div>
      {changed ? (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("relative ml-0.5 inline-flex items-center gap-1 font-mono text-[10px] font-medium", theme.varChangedHint)}
          title="Updated this step"
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", theme.varChangedDot)} aria-hidden />
          upd
        </motion.span>
      ) : null}
    </motion.div>
  )
}

interface CodeReplayProps {
  code: string
  steps: CodeReplayStep[]
  onHighlightLine: (lineNumber: number) => void
  onClearHighlight: () => void
  onShowExplanation?: () => void
  isLoading?: boolean
  theme?: "light" | "dark"
  progressCacheKey?: string
  studentId?: string | null
}

export function CodeReplay({
  code,
  steps,
  onHighlightLine,
  onClearHighlight,
  onShowExplanation,
  isLoading = false,
  theme = "dark",
  progressCacheKey,
  studentId = null,
}: CodeReplayProps) {
  const isLight = theme === "light"
  const t = replayTheme(isLight)
  const reducedMotion = useReducedMotion()
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [paceMode, setPaceMode] = useState<ReplayPaceMode>(() => {
    if (progressCacheKey) {
      const saved = loadReplayProgress(studentId, progressCacheKey)
      if (saved?.paceMode) return normalizePaceMode(saved.paceMode)
    }
    return "tutorial"
  })
  const [direction, setDirection] = useState(1)
  const [progressHydrated, setProgressHydrated] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const prevVarsRef = useRef<Record<string, string | number | boolean>>({})
  const codeScrollRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLOListElement>(null)

  const mode = REPLAY_PACE_MODES[normalizePaceMode(paceMode)]
  const replayMotion = useMemo(() => buildMotion(mode), [paceMode])

  const current = steps[currentStep] ?? null
  const progress = steps.length ? ((currentStep + 1) / steps.length) * 100 : 0

  const displayExplanation = current ? getExplanationForMode(current, mode) : ""
  const displayBullets = current ? getBulletsForMode(current, mode) : []
  const displayDeepInsight = current && mode.showDeepInsight ? getDeepInsight(current) : undefined

  const changedKeys = useMemo(() => {
    if (!current) return new Set<string>()
    const explicit = new Set(current.changedVariables ?? [])
    for (const [k, v] of Object.entries(current.variables)) {
      if (prevVarsRef.current[k] !== v) explicit.add(k)
    }
    return explicit
  }, [current])

  const codeLines = code.split("\n")

  const visibleLineRange = useMemo(() => {
    if (!current) return { start: 0, end: codeLines.length }
    const active = current.lineNumber - 1
    const pad = mode.codeContextPad
    return {
      start: Math.max(0, active - pad),
      end: Math.min(codeLines.length, active + pad + 1),
    }
  }, [current, codeLines.length, mode.codeContextPad])

  useEffect(() => {
    setCurrentStep(0)
    setIsPlaying(false)
    setDirection(1)
    prevVarsRef.current = {}
    setProgressHydrated(false)
  }, [steps])

  useEffect(() => {
    if (!progressCacheKey || !steps.length || progressHydrated) return
    const saved = loadReplayProgress(studentId, progressCacheKey)
    if (saved) {
      setCurrentStep(Math.min(saved.step, steps.length - 1))
      setPaceMode(normalizePaceMode(saved.paceMode))
    }
    setProgressHydrated(true)
  }, [progressCacheKey, steps.length, studentId, progressHydrated])

  useEffect(() => {
    if (!progressCacheKey || !steps.length || !progressHydrated) return
    saveReplayProgress(studentId, progressCacheKey, { step: currentStep, paceMode })
  }, [currentStep, paceMode, progressCacheKey, steps.length, studentId, progressHydrated])

  useEffect(() => {
    if (current) prevVarsRef.current = { ...current.variables }
  }, [currentStep, current])

  // Per-step auto-advance — waits for reveal animations in slower modes
  useEffect(() => {
    if (!isPlaying || !current || currentStep >= steps.length - 1) return
    const delay = computeAutoAdvanceMs(current, mode, !!reducedMotion)
    const timer = setTimeout(() => {
      setDirection(1)
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
    }, delay)
    return () => clearTimeout(timer)
  }, [isPlaying, currentStep, current, mode, steps.length, reducedMotion])

  useEffect(() => {
    if (currentStep >= steps.length - 1 && isPlaying) setIsPlaying(false)
  }, [currentStep, steps.length, isPlaying])

  const onHighlightLineRef = useRef(onHighlightLine)
  onHighlightLineRef.current = onHighlightLine

  useEffect(() => {
    if (current) onHighlightLineRef.current(current.lineNumber)
  }, [currentStep, current?.lineNumber])

  useEffect(() => {
    if (!current || !codeScrollRef.current) return
    const row = codeScrollRef.current.querySelector(`[data-line="${current.lineNumber}"]`)
    row?.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" })
  }, [current, reducedMotion])

  useEffect(() => {
    if (!timelineRef.current) return
    const active = timelineRef.current.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
  }, [currentStep, reducedMotion])

  useEffect(() => {
    if (steps.length > 0 && !isLoading && !reducedMotion && progressHydrated) {
      const t = setTimeout(() => setIsPlaying(true), 800)
      return () => clearTimeout(t)
    }
  }, [steps.length, isLoading, reducedMotion, progressHydrated])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [expanded])

  const goTo = (index: number) => {
    setDirection(index >= currentStep ? 1 : -1)
    setIsPlaying(false)
    setCurrentStep(Math.max(0, Math.min(steps.length - 1, index)))
  }

  const slideVariants = replayMotion.slide(!!reducedMotion, direction)

  if (isLoading) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-4 p-6", t.root)}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-violet-500/30 border-t-violet-400"
        />
        <p className={cn("text-sm", t.muted)}>Building step-by-step walkthrough…</p>
      </div>
    )
  }

  if (!steps.length) {
    return (
      <div className={cn("flex h-full items-center justify-center", t.muted)}>
        No replay data — click Explain or Walk through with Cora.
      </div>
    )
  }

  const replayUi = (
    <div className={cn("flex h-full min-h-0 flex-col", t.root, expanded && "h-dvh max-h-dvh")}>
      <div className={cn("shrink-0 border-b p-3 backdrop-blur", t.header)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold", t.title)}>
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Execution walkthrough
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", t.stepBadge)}>
            Step {currentStep + 1} / {steps.length}
          </span>
        </div>
        <div className={cn("relative mb-3 h-2 overflow-hidden rounded-full", t.progressTrack)}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400"
            animate={{ width: `${progress}%` }}
            transition={{ duration: mode.slideDuration, ease: replayMotion.ease }}
          />
          {paceMode !== "fast" ? (
            <motion.div
              className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["-2rem", `${Math.max(progress, 8)}%`] }}
              transition={{ duration: paceMode === "deep-dive" ? 2.6 : 1.8, repeat: Infinity, ease: "linear" }}
              style={{ left: 0 }}
            />
          ) : null}
        </div>

        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {steps.map((step, i) => (
            <button
              key={`m-${step.lineNumber}-${i}`}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "h-2 shrink-0 rounded-full transition-all",
                i === currentStep ? "w-7 bg-violet-600" : i < currentStep ? cn("w-2", t.dotDone) : cn("w-2", t.dotIdle),
              )}
              aria-label={`Step ${i + 1}: ${step.title}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false)
                  return
                }
                if (currentStep >= steps.length - 1) goTo(0)
                setIsPlaying(true)
              }}
              className="rounded-full border-0 bg-violet-600 text-white hover:bg-violet-500"
            >
              {isPlaying ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : currentStep >= steps.length - 1 ? "Replay" : "Play"}
            </Button>
            <Button variant="outline" size="icon" className={cn("h-8 w-8 rounded-full", t.outlineBtn)} onClick={() => goTo(currentStep - 1)} disabled={currentStep === 0}>
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className={cn("h-8 w-8 rounded-full", t.outlineBtn)} onClick={() => goTo(currentStep + 1)} disabled={currentStep >= steps.length - 1}>
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className={cn("h-8 w-8 rounded-full", t.outlineBtn)} onClick={() => { setIsPlaying(false); goTo(0); onClearHighlight() }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn("h-8 w-8 rounded-full", t.outlineBtn)}
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Exit immersive walkthrough" : "Expand walkthrough"}
              title={expanded ? "Exit immersive (Esc)" : "Expand walkthrough"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              value={paceMode}
              onChange={(e) => setPaceMode(e.target.value as ReplayPaceMode)}
              className={cn("h-8 shrink-0 rounded-full border px-3 text-[11px]", t.select)}
              aria-label="Walkthrough pace"
              title={
                paceMode === "fast"
                  ? "Summary text · quick animations"
                  : paceMode === "normal"
                    ? "Full explanation · standard pace"
                    : paceMode === "tutorial"
                      ? "Bullets + tips · guided pace"
                      : "Deep insights · slowest reveal"
              }
            >
              {(Object.entries(REPLAY_PACE_MODES) as [ReplayPaceMode, ReplayModeConfig][]).map(([id, cfg]) => (
                <option key={id} value={id}>
                  {cfg.label}
                </option>
              ))}
            </select>
            {onShowExplanation ? (
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 shrink-0 rounded-full px-3 text-xs", t.fullTextBtn)}
                onClick={onShowExplanation}
              >
                Full text
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          expanded ? "lg:grid-cols-[minmax(200px,240px)_1fr]" : "lg:grid-cols-[minmax(168px,188px)_1fr]",
        )}
      >
        <ol ref={timelineRef} className={cn("hidden shrink-0 overflow-y-auto border-r py-3 pl-3 pr-2 lg:block", t.timeline)}>
          {steps.map((step, i) => {
            const done = i < currentStep
            const active = i === currentStep
            return (
              <li
                key={`${step.lineNumber}-${i}`}
                data-active={active ? "true" : undefined}
                className="flex gap-3"
              >
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Step ${i + 1}: ${step.title}`}
                    className={cn(
                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                      done ? t.timelineDotDone : active ? t.timelineDotActive : t.timelineDotPending,
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : i + 1}
                  </button>
                  {i < steps.length - 1 ? (
                    <span
                      className={cn(
                        "mt-2 mb-2 w-0.5 min-h-4 flex-1 rounded-full",
                        done ? t.timelineLineDone : t.timelineLinePending,
                      )}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "mb-2 min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left transition-colors last:mb-0",
                    active ? t.timelineRowActive : t.timelineRowHover,
                  )}
                >
                  <span
                    className={cn(
                      "block truncate text-[11px] font-semibold leading-tight",
                      active ? t.timelineTitleActive : done ? t.timelineTitleDone : t.timelineTitle,
                    )}
                  >
                    {step.title}
                  </span>
                  <span className={cn("text-[10px]", active ? t.timelineMetaActive : t.timelineMeta)}>
                    Line {step.lineNumber}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          <AnimatePresence mode="wait" custom={direction}>
            {current ? (
              <motion.div
                key={`${currentStep}-${paceMode}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={replayMotion.slideTransition}
              >
                <motion.div variants={replayMotion.stagger} initial="hidden" animate="show" className="space-y-4">
                  <motion.div variants={replayMotion.item} className="flex flex-wrap items-center gap-2">
                    {current.phase ? (
                      <Badge variant="outline" className={cn("text-[10px] capitalize", t.phase[current.phase] ?? t.phase.setup)}>
                        {current.phase}
                      </Badge>
                    ) : null}
                    {mode.showConceptBadge && current.concept ? (
                      <Badge variant="outline" className={cn("text-[10px]", t.conceptBadge)}>
                        {current.concept}
                      </Badge>
                    ) : null}
                    {paceMode === "fast" ? (
                      <Badge variant="outline" className={cn("text-[9px]", t.summaryBadge)}>
                        summary
                      </Badge>
                    ) : null}
                  </motion.div>

                  <motion.h3 variants={replayMotion.item} className={cn("text-xl font-bold tracking-tight", t.heading)}>
                    {current.title}
                  </motion.h3>

                  <motion.div
                    variants={replayMotion.item}
                    ref={codeScrollRef}
                    className={cn(
                      "overflow-y-auto overflow-x-hidden rounded-xl border font-mono text-xs",
                      t.codeWindow,
                      mode.codeContextPad >= 3 ? "max-h-52" : "max-h-44",
                    )}
                  >
                    {codeLines.slice(visibleLineRange.start, visibleLineRange.end).map((line, idx) => {
                      const lineNum = visibleLineRange.start + idx + 1
                      const isActive = lineNum === current.lineNumber
                      return (
                        <motion.div
                          key={lineNum}
                          data-line={lineNum}
                          layout
                          animate={{
                            backgroundColor: isActive ? t.codeActiveBg : "transparent",
                            borderLeftColor: isActive ? (isLight ? "rgb(124, 58, 237)" : "rgb(167, 139, 250)") : "transparent",
                          }}
                          transition={{ duration: mode.itemDuration }}
                          className={cn(
                            "flex border-l-[3px] border-transparent px-3 py-1",
                            isActive && paceMode !== "fast" && "execution-line-active",
                          )}
                        >
                          <span className={cn("mr-3 w-5 shrink-0 select-none", isActive ? cn("font-bold", t.codeNumActive) : t.codeNum)}>
                            {lineNum}
                          </span>
                          <span className={cn("whitespace-pre", isActive ? cn("font-medium", t.codeLineActive) : t.codeLine)}>{line || " "}</span>
                          {isActive ? (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: mode.itemDuration }}
                              className={cn("ml-auto self-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", t.nowBadge)}
                            >
                              now
                            </motion.span>
                          ) : null}
                        </motion.div>
                      )
                    })}
                  </motion.div>

                  {current.condition ? (
                    <motion.div
                      variants={replayMotion.item}
                      className={cn("rounded-xl border p-3.5", t.conditionBox)}
                    >
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", t.conditionLabel)}>
                        Condition check
                      </p>
                      <p className={cn("mt-2.5 font-mono text-sm leading-relaxed", t.conditionText)}>
                        {current.condition}
                      </p>
                      {current.result ? (
                        <p
                          className={cn(
                            "mt-2.5 font-mono text-sm font-medium",
                            current.result.toLowerCase().includes("false") ? t.conditionFalse : t.conditionTrue,
                          )}
                        >
                          → {current.result}
                        </p>
                      ) : null}
                    </motion.div>
                  ) : null}

                  {Object.keys(current.variables).length > 0 ? (
                    <motion.div variants={replayMotion.item}>
                      <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-wider", t.memoryLabel)}>Memory</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(current.variables).map(([key, value]) => (
                          <VariableCard
                            key={key}
                            name={key}
                            value={value}
                            changed={changedKeys.has(key)}
                            prevValue={changedKeys.has(key) ? prevVarsRef.current[key] : undefined}
                            reducedMotion={!!reducedMotion}
                            motionItem={replayMotion.item}
                            itemDuration={mode.itemDuration}
                            theme={t}
                          />
                        ))}
                      </div>
                    </motion.div>
                  ) : null}

                  {current.consoleOutput ? (
                    <motion.div
                      variants={replayMotion.item}
                      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("overflow-hidden rounded-xl border", t.consoleBox)}
                    >
                      <div className={cn("flex items-center gap-2 border-b px-3 py-1.5", t.consoleHeader)}>
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">Console</span>
                      </div>
                      <motion.pre
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: mode.staggerChildren * 2, duration: mode.itemDuration }}
                        className="p-3 font-mono text-sm text-cyan-100"
                      >
                        {current.consoleOutput}
                      </motion.pre>
                    </motion.div>
                  ) : null}

                  <motion.div
                    variants={replayMotion.item}
                    className={cn("rounded-xl border p-4", t.explainBox)}
                  >
                    <p className={cn("mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", t.explainLabel)}>
                      <ChevronRight className="h-3 w-3" />
                      What happens
                    </p>
                    <AnimatedSentences text={displayExplanation} reducedMotion={!!reducedMotion} motionItem={replayMotion.item} bodyClass={t.bodyText} />
                    {displayBullets.length ? (
                      <ul className={cn("mt-3 space-y-2 border-t pt-3", t.bulletDivider)}>
                        {displayBullets.map((bullet, bi) => (
                          <motion.li
                            key={bi}
                            variants={replayMotion.item}
                            initial={reducedMotion ? false : "hidden"}
                            animate="show"
                            transition={{ delay: mode.bulletStagger * bi }}
                            className={cn("flex gap-2 text-xs leading-relaxed", t.bulletText)}
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                            {bullet}
                          </motion.li>
                        ))}
                      </ul>
                    ) : null}
                  </motion.div>

                  {mode.showTeachingNotes && current.teachingNote ? (
                    <motion.div
                      variants={replayMotion.item}
                      className={cn("flex gap-2 rounded-xl border p-3", t.tipBox)}
                    >
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className={cn("mb-1 text-[10px] font-bold uppercase tracking-wider", isLight ? "text-amber-600" : "text-amber-400/90")}>Pro tip</p>
                        <p className={cn("text-xs leading-relaxed", t.tipText)}>{current.teachingNote}</p>
                      </div>
                    </motion.div>
                  ) : null}

                  {displayDeepInsight ? (
                    <motion.div
                      variants={replayMotion.item}
                      className={cn("flex gap-2 rounded-xl border p-3", t.deepBox)}
                    >
                      <Search className={cn("mt-0.5 h-4 w-4 shrink-0", isLight ? "text-indigo-600" : "text-indigo-300")} />
                      <div>
                        <p className={cn("mb-1 text-[10px] font-bold uppercase tracking-wider", t.deepLabel)}>Deep dive</p>
                        <p className={cn("text-xs leading-relaxed", t.tipText)}>{displayDeepInsight}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div
        className={cn(
          "fixed inset-0 z-[100] flex flex-col",
          isLight ? "bg-white" : "bg-[#080b10]",
        )}
      >
        {replayUi}
      </div>,
      document.body,
    )
  }

  return replayUi
}
