"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
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
  CORA_COACH_PROMPTS,
  deriveAcademicHealth,
  deriveClassContext,
  deriveGradeOutlook,
  deriveLearningJourney,
  deriveLearningProfile,
  deriveMasteryDomains,
  deriveReadiness,
  deriveSemesterJourney,
  deriveStreakStrip,
  type InsightsProgressPayload,
  type MasteryDomain,
  type MasteryTopic,
} from "@/lib/cora/insights-workspace"

type Props = {
  studentId: string
  studentDatabaseId?: number | null
  studentContext?: CoraStudentContextPayload | null
  onNavigate?: (tab: CoraPlatformTab) => void
}

export function CoraInsightsPanel({
  studentId,
  studentDatabaseId,
  studentContext = null,
  onNavigate,
}: Props) {
  const { cta, soft, mid, accent, tone } = useCoraContentPalette()
  const cora = useCoraOptional()
  const [progress, setProgress] = useState<InsightsProgressPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [showClassContext, setShowClassContext] = useState(false)
  const [showScenarios, setShowScenarios] = useState(false)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/ai-tutor/progress-detailed?studentId=${encodeURIComponent(studentId)}`,
        )
        if (res.ok && !cancelled) {
          const raw = await res.json()
          setProgress({
            conceptMastery: (raw.conceptMastery || []).map((t: Record<string, unknown>) => ({
              topic: String(t.topic || ""),
              mastery: Number(t.mastery_percentage ?? t.mastery) || 0,
            })),
            misconceptions: raw.misconceptions || [],
            interactionTrends: raw.interactionTrends || {},
            conversationTimeline: raw.conversationTimeline || [],
            streak: Number(raw.weeklyStreak ?? raw.streak) || undefined,
          })
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [studentId])

  const health = useMemo(
    () => deriveAcademicHealth(progress, studentContext),
    [progress, studentContext],
  )
  const readiness = useMemo(() => deriveReadiness(studentContext), [studentContext])
  const journey = useMemo(
    () => deriveLearningJourney(progress, studentContext),
    [progress, studentContext],
  )
  const grade = useMemo(() => deriveGradeOutlook(studentContext), [studentContext])
  const profile = useMemo(
    () => deriveLearningProfile(progress, studentContext),
    [progress, studentContext],
  )
  const domains = useMemo(
    () => deriveMasteryDomains(progress, studentContext),
    [progress, studentContext],
  )
  const semester = useMemo(
    () => deriveSemesterJourney(studentContext, readiness),
    [studentContext, readiness],
  )
  const streak = useMemo(
    () => deriveStreakStrip(progress, studentContext),
    [progress, studentContext],
  )
  const classCtx = useMemo(() => deriveClassContext(studentContext), [studentContext])
  const monthDelta = journey.length
    ? journey[journey.length - 1]!.pct - journey[0]!.pct
    : 0

  const askCora = (prompt: string, title = "Learning Intelligence") => {
    if (cora) {
      cora.openCora(
        coraContextFromQuestion({
          source: "custom",
          domain: "generic",
          title,
          questionText: prompt,
          studentDatabaseId: studentDatabaseId ?? (studentId ? Number(studentId) : null),
        }),
      )
      return
    }
    onNavigate?.("workspace")
  }

  return (
    <div className="space-y-6">
      {/* 1. Academic Health */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
                Cora Learning Intelligence
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
                Academic Health
              </h2>
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <span className="text-5xl font-bold tabular-nums tracking-tight text-[var(--cc-text)]">
                  {loading ? "—" : health.score}
                </span>
                <div className="pb-1">
                  <p className="text-sm font-semibold text-[var(--cc-text)]">{health.label}</p>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    {health.deltaWeek >= 0 ? "↑" : "↓"} {Math.abs(health.deltaWeek)} this week
                  </p>
                </div>
              </div>
              <p className="max-w-xl text-sm text-[var(--cc-text-secondary)]">
                {health.coachingLine}{" "}
                <span className="font-medium text-[var(--cc-text)]">{health.focusTopic}</span> remains
                your biggest opportunity before the next assessment.
              </p>
            </div>
            <Button
              className="shrink-0 rounded-xl"
              style={{ background: cta.fill, color: cta.icon }}
              onClick={() =>
                askCora(
                  `My academic health is ${health.score} (${health.label}). Focus topic: ${health.focusTopic}. What should I do tonight?`,
                )
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Coach me tonight
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {CORA_COACH_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => askCora(p.prompt, p.label)}
                className="rounded-full border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-accent)]/40 hover:text-[var(--cc-text)]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Compact streak */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <Flame className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-[var(--cc-text)]">
          {streak.current}-day streak
        </p>
        <span className="text-xs text-[var(--cc-text-muted)]">Best: {streak.longest} days</span>
        <span className="text-xs text-[var(--cc-text-muted)]">
          Today&apos;s goal {streak.goalsDone}/{streak.goalsTotal}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {streak.goals.map((g) => (
            <span
              key={g.id}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                g.done
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-[var(--muted)]/50 text-[var(--cc-text-muted)]",
              )}
            >
              {g.done ? "✓" : "○"} {g.label}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Readiness */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Readiness</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Readiness vs completion — labeled clearly
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {readiness.map((item, i) => {
            const swatch = tone(i)
            return (
              <div key={item.id} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                <p className="text-xs font-medium text-[var(--cc-text-muted)]">{item.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--cc-text)]">
                  {item.pct}%
                </p>
                <p className="mt-1 text-xs font-semibold" style={{ color: swatch.fill }}>
                  {item.status}
                </p>
                <Progress value={item.pct} className="mt-3 h-1.5" />
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. Learning Journey + Grade Outlook */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: accent }} />
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Learning journey</h3>
            </div>
            {monthDelta !== 0 ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {monthDelta > 0 ? "+" : ""}
                {monthDelta} points this month
              </p>
            ) : null}
          </div>
          <JourneySparkline points={journey} color={cta.fill} />
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Grade outlook</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--muted)]/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Current
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--cc-text)]">
                {grade.currentLetter}{" "}
                <span className="text-sm font-semibold text-[var(--cc-text-muted)]">
                  ({grade.currentPct}%)
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--muted)]/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Projected
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--cc-text)]">
                {grade.projectedLetter}{" "}
                <span className="text-sm font-semibold text-[var(--cc-text-muted)]">
                  ({grade.projectedLow}–{grade.projectedHigh}%)
                </span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--cc-text-muted)]">{grade.basis}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 rounded-full"
            onClick={() => setShowScenarios((v) => !v)}
          >
            Explore scenarios
            <ChevronDown
              className={cn("ml-1 h-3.5 w-3.5 transition-transform", showScenarios && "rotate-180")}
            />
          </Button>
          <AnimatePresence>
            {showScenarios ? (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 overflow-hidden"
              >
                {grade.scenarios.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--cc-text-secondary)]"
                  >
                    <span className="font-semibold text-[var(--cc-text)]">{s.condition}</span>
                    {" → "}
                    {s.outcome}
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </section>
      </div>

      {/* 4. Learning Profile */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4" style={{ color: accent }} />
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Your learning profile</h3>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Strong
              </p>
              <ul className="space-y-1.5">
                {profile.strong.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-[var(--cc-text)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Needs attention
              </p>
              <ul className="space-y-2">
                {profile.needsAttention.map((n) => (
                  <li key={n.topic} className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 text-[var(--cc-text)]">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      {n.topic}
                    </span>
                    <span className="tabular-nums font-semibold text-[var(--cc-text-muted)]">
                      {n.mastery}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {profile.recurringDifficulty ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  Recurring difficulty
                </p>
                <p className="text-sm font-semibold text-[var(--cc-text)]">
                  {profile.recurringDifficulty}
                </p>
              </div>
            ) : null}

            <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">
              {profile.interpretation}
            </p>

            <div className="flex flex-wrap gap-2">
              {profile.recurringDifficulty ? (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  style={{ backgroundColor: cta.fill, color: cta.icon }}
                  onClick={() =>
                    askCora(
                      `Help me practice and master: ${profile.recurringDifficulty}`,
                      "Practice",
                    )
                  }
                >
                  Practice {profile.recurringDifficulty.split(" ")[0]}
                </Button>
              ) : null}
              {profile.needsAttention[0] ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onNavigate?.("learn")}
                >
                  Review {profile.needsAttention[0].topic.split(" ").slice(0, 2).join(" ")}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  askCora(
                    `Explain my learning profile and what to fix first. Weak areas: ${profile.needsAttention.map((n) => n.topic).join(", ")}.`,
                  )
                }
              >
                Ask Cora
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Learning patterns
            </p>
            <dl className="space-y-3 text-sm">
              <PatternRow label="You learn best" value={profile.patterns.bestWindow} />
              <PatternRow
                label="Average session"
                value={`${profile.patterns.avgSessionMins} minutes`}
              />
              <PatternRow label="Most productive day" value={profile.patterns.bestDay} />
              <PatternRow label="Best mode" value={profile.patterns.bestMode} />
            </dl>
          </div>
        </div>
      </section>

      {/* 5. Mastery */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--cc-text)]">Mastery</h3>
        <ul className="space-y-3">
          {domains.map((domain, i) => (
            <MasteryDomainRow
              key={domain.id}
              domain={domain}
              expanded={expandedDomain === domain.id}
              expandedTopic={expandedTopic}
              barColor={tone(i).fill}
              onToggle={() =>
                setExpandedDomain((prev) => (prev === domain.id ? null : domain.id))
              }
              onToggleTopic={(id) =>
                setExpandedTopic((prev) => (prev === id ? null : id))
              }
              onAsk={(topic) =>
                askCora(`Help me improve mastery of ${topic}. Explain why I'm stuck and what to practice.`, topic)
              }
              onPractice={() => onNavigate?.("solve")}
              onReview={() => onNavigate?.("learn")}
            />
          ))}
        </ul>
      </section>

      {/* 6. Semester Journey */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--cc-text)]">Semester journey</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {semester.nodes.map((node, i) => (
            <div key={node.id} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                  node.state === "done" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  node.state === "current" && "text-white",
                  node.state === "risk" && "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                  node.state === "upcoming" && "bg-[var(--muted)]/50 text-[var(--cc-text-muted)]",
                )}
                style={node.state === "current" ? { backgroundColor: cta.fill } : undefined}
              >
                {node.state === "done" ? `${node.label} ✓` : node.state === "risk" ? `${node.label} !` : node.state === "current" ? `${node.label} ●` : node.label}
              </span>
              {i < semester.nodes.length - 1 ? (
                <span className="text-[var(--cc-text-muted)]">—</span>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--cc-text-secondary)]">
          <span className="font-semibold text-[var(--cc-text)]">Next milestone:</span>{" "}
          {semester.nextMilestone} · {semester.daysUntil} days
        </p>
        <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">
          Readiness:{" "}
          <span className="font-semibold text-[var(--cc-text)]">
            {semester.readinessPct}% — {semester.readinessStatus}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-full"
            style={{ backgroundColor: cta.fill, color: cta.icon }}
            onClick={() =>
              askCora(
                `Help me prepare for ${semester.nextMilestone}. My readiness is ${semester.readinessPct}% (${semester.readinessStatus}).`,
              )
            }
          >
            Prepare for {semester.nextMilestone.split(" ")[0]}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onNavigate?.("study-plan")}
          >
            Build my plan
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </section>

      {/* Optional class context */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-[var(--cc-text)]"
          onClick={() => setShowClassContext((v) => !v)}
        >
          Class context
          <ChevronDown
            className={cn("h-4 w-4 text-[var(--cc-text-muted)] transition-transform", showClassContext && "rotate-180")}
          />
        </button>
        <AnimatePresence>
          {showClassContext ? (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 overflow-hidden"
            >
              {classCtx.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-[var(--muted)]/25 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--cc-text)]">{row.label}</span>
                  <span className="text-[var(--cc-text-secondary)]">
                    {row.you}% · Class median {row.classMedian}%
                    <span
                      className={cn(
                        "ml-2 font-semibold",
                        row.delta >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {row.delta >= 0 ? "+" : ""}
                      {row.delta} pts
                    </span>
                  </span>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Ask Cora */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Ask Cora about my progress
        </p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">Coaching, not dashboards.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CORA_COACH_PROMPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => askCora(p.prompt, p.label)}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] hover:border-[var(--cc-accent)]/40 hover:text-[var(--cc-text)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function JourneySparkline({
  points,
  color,
}: {
  points: Array<{ week: string; pct: number }>
  color: string
}) {
  const w = 320
  const h = 120
  const pad = 16
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1))
  const ys = points.map((p) => h - pad - ((p.pct - 20) / 80) * (h - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ")

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label="Academic health trend">
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <g key={points[i]!.week}>
            <circle cx={x} cy={ys[i]} r={i === xs.length - 1 ? 6 : 4} fill={color} />
            <text
              x={x}
              y={ys[i]! - 12}
              textAnchor="middle"
              className="fill-[var(--cc-text)] text-[10px] font-bold"
            >
              {points[i]!.pct}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-[var(--cc-text-muted)]">
        {points.map((p) => (
          <span key={p.week}>{p.week}</span>
        ))}
      </div>
    </div>
  )
}

function MasteryDomainRow({
  domain,
  expanded,
  expandedTopic,
  barColor,
  onToggle,
  onToggleTopic,
  onAsk,
  onPractice,
  onReview,
}: {
  domain: MasteryDomain
  expanded: boolean
  expandedTopic: string | null
  barColor: string
  onToggle: () => void
  onToggleTopic: (id: string) => void
  onAsk: (topic: string) => void
  onPractice: () => void
  onReview: () => void
}) {
  return (
    <li className="rounded-2xl border border-[var(--border)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--cc-text)]">{domain.label}</span>
            <span className="tabular-nums text-sm font-bold text-[var(--cc-text)]">
              {domain.mastery}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div className="h-full rounded-full" style={{ width: `${domain.mastery}%`, backgroundColor: barColor }} />
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[var(--cc-text-muted)] transition-transform", expanded && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {expanded ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 overflow-hidden border-t border-[var(--border)] px-3 py-2"
          >
            {domain.topics.map((topic) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                open={expandedTopic === topic.id}
                onToggle={() => onToggleTopic(topic.id)}
                onAsk={() => onAsk(topic.label)}
                onPractice={onPractice}
                onReview={onReview}
              />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

function TopicRow({
  topic,
  open,
  onToggle,
  onAsk,
  onPractice,
  onReview,
}: {
  topic: MasteryTopic
  open: boolean
  onToggle: () => void
  onAsk: () => void
  onPractice: () => void
  onReview: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm hover:bg-[var(--muted)]/30"
      >
        <span className="font-medium text-[var(--cc-text)]">{topic.label}</span>
        <span className="tabular-nums text-[var(--cc-text-muted)]">{topic.mastery}%</span>
      </button>
      <AnimatePresence>
        {open && topic.why ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-2 pb-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Why is this low?
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-[var(--cc-text-secondary)]">
              <li>{topic.why.incorrectAttempts} incorrect practice attempts</li>
              <li>{topic.why.confusionSignals} Cora confusion signals</li>
              <li>{topic.why.debugSessions} debugging session{topic.why.debugSessions === 1 ? "" : "s"}</li>
              <li>Last practiced {topic.why.daysSincePractice} days ago</li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" className="rounded-full h-7 text-[11px]" onClick={onReview}>
                Review
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full h-7 text-[11px]" onClick={onPractice}>
                Practice
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full h-7 text-[11px]" onClick={onAsk}>
                Ask Cora
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

function PatternRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--cc-text-muted)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--cc-text)]">{value}</dd>
    </div>
  )
}
