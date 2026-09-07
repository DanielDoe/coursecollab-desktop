"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Flame,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useCoraOptional } from "@/components/cora/CoraProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import {
  deriveCoachMessage,
  deriveDeadlines,
  deriveEstimatedMinutes,
  deriveFocusTopics,
  deriveJourneySteps,
  derivePlanWhy,
  derivePreparedResources,
  deriveSessionComplete,
  deriveSessionDurations,
  deriveStreakBadge,
  deriveStudySchedule,
  deriveWeeklyGoals,
  greetingForNow,
  PLAN_STORAGE_KEY,
  scaleJourneyMinutes,
  weeklyCompletionPct,
  type JourneyStep,
  type JourneyStepId,
  type StudyPlanStage,
} from "@/lib/cora/study-plan-workspace"

type Props = {
  studentFirstName?: string
  studentDatabaseId?: number | null
  studentContext?: CoraStudentContextPayload | null
  onNavigate?: (tab: CoraPlatformTab) => void
}

export function CoraStudyPlanPanel({
  studentFirstName = "there",
  studentDatabaseId,
  studentContext = null,
  onNavigate,
}: Props) {
  const { cta, soft, mid, accent, tone } = useCoraContentPalette()
  const cora = useCoraOptional()
  const [stage, setStage] = useState<StudyPlanStage>("coach")
  const [completed, setCompleted] = useState<JourneyStepId[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [expandedStep, setExpandedStep] = useState<JourneyStepId | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const [budgetId, setBudgetId] = useState<"15" | "30" | "45" | "60">("30")
  const [scheduleDay, setScheduleDay] = useState<string | null>(null)
  const [generatedAt] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  )

  const topics = useMemo(() => deriveFocusTopics(studentContext), [studentContext])
  const deadlines = useMemo(() => deriveDeadlines(studentContext), [studentContext])
  const baseMinutes = useMemo(
    () => deriveEstimatedMinutes(topics, deadlines.length),
    [topics, deadlines.length],
  )
  const durations = useMemo(() => deriveSessionDurations(topics), [topics])
  const selectedDuration = durations.find((d) => d.id === budgetId) || durations[1]!
  const plannedMinutes =
    budgetId === "30" && stage === "coach" ? baseMinutes : selectedDuration.minutes

  const baseJourney = useMemo(
    () => deriveJourneySteps(topics, studentContext),
    [topics, studentContext],
  )
  const journey = useMemo(
    () => scaleJourneyMinutes(baseJourney, plannedMinutes),
    [baseJourney, plannedMinutes],
  )
  const why = useMemo(() => derivePlanWhy(studentContext, topics), [studentContext, topics])
  const resources = useMemo(() => derivePreparedResources(topics), [topics])
  const weekly = useMemo(() => deriveWeeklyGoals(studentContext), [studentContext])
  const weeklyPct = useMemo(() => weeklyCompletionPct(weekly), [weekly])
  const schedule = useMemo(
    () => deriveStudySchedule(topics, plannedMinutes),
    [topics, plannedMinutes],
  )
  const coach = useMemo(
    () => deriveCoachMessage(topics, studentContext?.strengths || []),
    [topics, studentContext?.strengths],
  )
  const streak = useMemo(() => deriveStreakBadge(studentContext), [studentContext])
  const complete = useMemo(
    () => deriveSessionComplete(plannedMinutes, topics),
    [plannedMinutes, topics],
  )

  const doneCount = completed.length
  const remainingMin = journey
    .filter((j) => !completed.includes(j.id))
    .reduce((s, j) => s + j.minutes, 0)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { completed?: JourneyStepId[]; stage?: StudyPlanStage }
      if (parsed.completed?.length) setCompleted(parsed.completed)
      if (parsed.stage === "complete") setStage("complete")
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ completed, stage }))
    } catch {
      /* ignore */
    }
  }, [completed, stage])

  const askCora = (prompt: string, title = "Study Plan") => {
    if (cora) {
      cora.openCora(
        coraContextFromQuestion({
          source: "custom",
          domain: "generic",
          title,
          questionText: prompt,
          studentDatabaseId: studentDatabaseId ?? null,
        }),
      )
      return
    }
    onNavigate?.("workspace")
  }

  const markStep = (id: JourneyStepId, index: number) => {
    setCompleted((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveStep(Math.min(journey.length - 1, index + 1))
  }

  const startSession = () => {
    setStage("session")
    setActiveStep(completed.length < journey.length ? completed.length : 0)
  }

  const finishSession = () => {
    setCompleted(journey.map((j) => j.id))
    setStage("complete")
  }

  const regenerate = () => {
    setCompleted([])
    setStage("coach")
    setActiveStep(0)
    askCora(
      `Regenerate my study plan. Focus topics: ${topics.join(", ")}. Deadlines: ${deadlines
        .map((d) => `${d.label} (${d.when})`)
        .join(", ")}.`,
      "Regenerate plan",
    )
  }

  if (stage === "complete") {
    return (
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage: `radial-gradient(ellipse at 50% 0%, ${cta.fill}28, transparent 55%)`,
            }}
          />
          <Trophy className="relative mx-auto mb-3 h-10 w-10 text-[var(--cc-accent)]" />
          <h2 className="relative text-2xl font-bold text-[var(--cc-text)]">
            Today&apos;s Session Complete
          </h2>
          <p className="relative mt-1 text-sm text-[var(--cc-text-muted)]">
            {complete.minutes} minutes with Cora
          </p>
          <div className="relative mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Topics" value={String(complete.topicsLearned)} />
            <Stat label="Flashcards" value={String(complete.flashcards)} />
            <Stat label="Problems" value={String(complete.problems)} />
            <Stat label="Quiz" value={`${complete.quizScore}%`} />
            <Stat label="Mastery" value={`+${complete.masteryDelta}%`} />
            <Stat label="XP" value={`+${complete.xp}`} />
          </div>
          <div className="relative mt-8 flex flex-wrap justify-center gap-2">
            <Button
              className="rounded-xl"
              style={{ background: cta.fill, color: cta.icon }}
              onClick={() => {
                setCompleted([])
                setStage("coach")
                setActiveStep(0)
              }}
            >
              Back to plan
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onNavigate?.("insights")}>
              View Insights
            </Button>
          </div>
        </motion.section>
      </div>
    )
  }

  if (stage === "session") {
    const step = journey[activeStep] ?? journey[0]!
    const elapsed = journey
      .slice(0, activeStep)
      .reduce((s, j) => s + (completed.includes(j.id) ? j.minutes : 0), 0)

    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Today&apos;s Session
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--cc-text)]">
                {elapsed} / {plannedMinutes} min
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setStage("coach")}>
              Exit session
            </Button>
          </div>
          <Progress
            value={(doneCount / Math.max(1, journey.length)) * 100}
            className="mt-3 h-2"
          />
          <ol className="mt-4 flex flex-wrap gap-2">
            {journey.map((j, i) => {
              const done = completed.includes(j.id)
              const current = i === activeStep
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(i)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                      done && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                      current && !done && "text-white",
                      !done && !current && "bg-[var(--muted)]/50 text-[var(--cc-text-muted)]",
                    )}
                    style={current && !done ? { backgroundColor: cta.fill } : undefined}
                  >
                    {done ? "✓" : "○"} {j.title}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Step {activeStep + 1} of {journey.length}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--cc-text)]">{step.title}</h2>
          <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">
            {step.detail} · ~{step.minutes} min
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            Cora keeps you in one session context while you work through this step in CourseCollab.
            Open the activity, then mark it complete to continue.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {step.href ? (
              <Button asChild className="rounded-xl" style={{ background: cta.fill, color: cta.icon }}>
                <Link href={step.href}>Open activity</Link>
              </Button>
            ) : null}
            {step.action ? (
              <Button
                type="button"
                className="rounded-xl"
                style={{ background: cta.fill, color: cta.icon }}
                onClick={() => onNavigate?.(step.action!)}
              >
                Open in Cora
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                askCora(
                  `Coach me through this study step: ${step.title} — ${step.detail}. Topic: ${step.topic}.`,
                  step.title,
                )
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Ask Cora
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={activeStep <= 0}
            onClick={() => setActiveStep((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            type="button"
            className="rounded-full"
            style={{ background: cta.fill, color: cta.icon }}
            onClick={() => {
              markStep(step.id, activeStep)
              if (activeStep >= journey.length - 1) finishSession()
              else setActiveStep((i) => i + 1)
            }}
          >
            {activeStep >= journey.length - 1 ? "Finish session" : "Continue"}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Coach / plan landing
  return (
    <div className="space-y-6">
      {/* 1 — AI Study Coach */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              AI Study Coach
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              {greetingForNow()}, {studentFirstName}
            </h2>
            <p className="max-w-xl text-sm text-[var(--cc-text-secondary)]">
              Based on your recent homework, mastery, upcoming assessments, and study activity.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Flame className="h-3.5 w-3.5" />
                {streak}-day streak
              </span>
              <span className="text-xs text-[var(--cc-text-muted)]">Generated {generatedAt}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Today&apos;s focus
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: cta.fill }}
                  >
                    <Check className="h-3 w-3" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-3xl font-bold tabular-nums text-[var(--cc-text)]">
              {plannedMinutes}{" "}
              <span className="text-base font-semibold text-[var(--cc-text-muted)]">min planned</span>
            </p>
          </div>
          <div className="flex w-full min-w-[12.5rem] flex-col gap-2 sm:min-w-[14rem] lg:w-auto lg:items-stretch">
            <Button
              className="h-11 w-full rounded-2xl shadow-sm"
              style={{ background: cta.fill, color: cta.icon }}
              onClick={startSession}
            >
              <Play className="mr-2 h-4 w-4 shrink-0" />
              Start Today&apos;s Session
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-2xl border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
              onClick={regenerate}
            >
              <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
              Regenerate Plan
            </Button>
          </div>
        </div>
      </header>

      {/* 2 — Why this plan */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Why Cora chose this</h3>
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setShowWhy((v) => !v)}>
            {showWhy ? "Hide" : "See"} reasoning
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5", showWhy && "rotate-180")} />
          </Button>
        </div>
        <ul className="mt-3 space-y-3">
          {why.map((item) => (
            <li key={item.id} className="rounded-2xl border border-[var(--border)] p-3">
              <p className="text-sm font-semibold text-[var(--cc-text)]">{item.topic}</p>
              <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{item.reason}</p>
              <AnimatePresence>
                {showWhy ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-xs font-medium text-[var(--cc-text-muted)]"
                  >
                    {item.meta}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 rounded-full"
          onClick={() =>
            askCora(
              `Explain why you chose this study plan focusing on ${topics.join(" and ")}.`,
              "Why this plan",
            )
          }
        >
          Ask Cora why
        </Button>
      </section>

      {/* 3 — Today's Journey */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Today&apos;s journey</h3>
            <p className="text-xs text-[var(--cc-text-muted)]">
              {doneCount} / {journey.length} completed · {remainingMin} min remaining
        </p>
      </div>
        </div>
        <ol className="space-y-0">
          {journey.map((step, i) => (
            <JourneyRow
              key={step.id}
              step={step}
              index={i}
              done={completed.includes(step.id)}
              expanded={expandedStep === step.id}
              isLast={i === journey.length - 1}
              accent={cta.fill}
              mid={mid}
              onToggle={() => setExpandedStep((prev) => (prev === step.id ? null : step.id))}
              onOpen={() => {
                if (step.href) return
                if (step.action) onNavigate?.(step.action)
              }}
              onComplete={() => markStep(step.id, i)}
              ctaFill={cta.fill}
              ctaIcon={cta.icon}
            />
          ))}
          <li className="flex gap-3 pt-1">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                doneCount === journey.length
                  ? "bg-emerald-500 text-white"
                  : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
              )}
            >
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--cc-text)]">Complete</p>
              <p className="text-xs text-[var(--cc-text-muted)]">XP unlocks when you finish the journey</p>
            </div>
          </li>
        </ol>
      </section>

      {/* 4 — Prepared by Cora */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Prepared for today&apos;s session</h3>
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onNavigate?.("tools")}>
            View all materials →
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r, i) => (
            <div
              key={r.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4"
            >
              <p className="text-sm font-semibold text-[var(--cc-text)]">{r.label}</p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{r.meta}</p>
              <span
                className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wide"
                style={{ color: tone(i).fill }}
              >
                Ready
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5 — Your Week */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Weekly plan</h3>
            <p className="text-xs font-semibold text-[var(--cc-text-muted)]">
              {weeklyPct}% complete · 3 days remaining
            </p>
          </div>
          <ul className="space-y-3">
            {weekly.map((g, i) => {
              const pct = Math.min(100, (g.current / Math.max(1, g.target)) * 100)
              return (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-[var(--cc-text)]">{g.label}</span>
                    <span className="tabular-nums text-[var(--cc-text-muted)]">
                      {g.current}
                      {g.unit || ""} / {g.target}
                      {g.unit || ""}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: tone(i).fill }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--cc-text)]">Upcoming</h3>
          <ul className="space-y-3">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--cc-text)]">{d.label}</p>
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      d.priority === "high" && "text-rose-500",
                      d.priority === "medium" && "text-amber-500",
                      d.priority === "low" && "text-[var(--cc-text-muted)]",
                    )}
                  >
                    {d.note}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-[var(--cc-text)]">{d.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 6 — Study Schedule + time budget */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--cc-text)]">Study schedule</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {schedule.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setScheduleDay((prev) => (prev === day.id ? null : day.id))}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                day.isToday ? "shadow-sm" : "border-[var(--border)] hover:bg-[var(--muted)]/20",
                day.done && !day.isToday && "opacity-70",
              )}
              style={
                day.isToday
                  ? { borderColor: cta.fill, backgroundColor: soft }
                  : undefined
              }
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
                {day.label}
                {day.done ? " ✓" : day.isToday ? " ●" : ""}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--cc-text)] line-clamp-2">
                {day.focus}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-[var(--cc-text-muted)]">
                {day.minutes}m
              </p>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {scheduleDay ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              {(() => {
                const day = schedule.find((d) => d.id === scheduleDay)
                if (!day?.blocks?.length) {
                  return (
                    <p className="text-xs text-[var(--cc-text-muted)]">
                      {day?.focus} · {day?.minutes} min planned
                    </p>
                  )
                }
                return (
                  <ul className="space-y-1.5 rounded-2xl border border-[var(--border)] p-3">
                    {day.blocks.map((b) => (
                      <li key={b.time} className="flex gap-3 text-sm">
                        <span className="w-16 shrink-0 tabular-nums text-[var(--cc-text-muted)]">
                          {b.time}
                        </span>
                        <span className="font-medium text-[var(--cc-text)]">{b.title}</span>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-xs font-semibold text-[var(--cc-text)]">Have less time?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {durations.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setBudgetId(d.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  budgetId === d.id
                    ? "text-white"
                    : "bg-[var(--muted)]/60 text-[var(--cc-text-secondary)]",
                )}
                style={budgetId === d.id ? { backgroundColor: cta.fill } : undefined}
              >
                {d.minutes} min
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
            Cora will build: {selectedDuration.steps.join(" → ")}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 rounded-full"
            style={{ background: cta.fill, color: cta.icon }}
            onClick={startSession}
          >
            Start {selectedDuration.minutes}-minute session
          </Button>
        </div>
      </section>

      {/* 7 — Cora Coach */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Cora Coach
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{coach.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-full"
            style={{ background: cta.fill, color: cta.icon }}
            onClick={() => askCora(coach.body + "\n\nWhat should I adjust?", "Cora Coach")}
          >
            Ask Cora
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={regenerate}>
            Adjust plan
          </Button>
        </div>
      </section>
    </div>
  )
}

function JourneyRow({
  step,
  index,
  done,
  expanded,
  isLast,
  accent,
  mid,
  onToggle,
  onOpen,
  onComplete,
  ctaFill,
  ctaIcon,
}: {
  step: JourneyStep
  index: number
  done: boolean
  expanded: boolean
  isLast: boolean
  accent: string
  mid: string
  onToggle: () => void
  onOpen: () => void
  onComplete: () => void
  ctaFill: string
  ctaIcon: string
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
          style={
            done
              ? { backgroundColor: "#10b981", color: "#fff" }
              : expanded
                ? { backgroundColor: accent, color: "#fff" }
                : {
                    backgroundColor: "transparent",
                    color: "var(--cc-text)",
                    boxShadow: `inset 0 0 0 2px ${mid}`,
                  }
          }
        >
          {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
        </button>
        {!isLast ? (
          <span className="w-px flex-1" style={{ backgroundColor: "var(--border)" }} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <button type="button" onClick={onToggle} className="w-full text-left">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--cc-text)]">{step.title}</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                {step.minutes} min · {step.detail}
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[var(--cc-text-muted)]">
              {step.progressLabel}
            </span>
          </div>
        </button>
        <AnimatePresence>
          {expanded ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                <Progress value={done ? 100 : step.progressPct} className="h-1.5" />
                <div className="flex flex-wrap gap-2">
                  {step.href ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full h-8">
                      <Link href={step.href}>{done ? "Open again" : "Resume"}</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8"
                      onClick={onOpen}
                    >
                      Start
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full h-8"
                    style={{ background: ctaFill, color: ctaIcon }}
                    onClick={onComplete}
                  >
                    {done ? "Done" : "Complete"}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)]/35 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[var(--cc-text)]">{value}</p>
    </div>
  )
}
