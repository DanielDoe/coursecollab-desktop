"use client"

import { useMemo } from "react"
import {
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Gift,
  HelpCircle,
  Lightbulb,
  Medal,
  PenLine,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { classroomPointIsProvisional } from "@/lib/classroom-points-ai-feedback.shared"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { cn } from "@/lib/utils"
import {
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"
import type { ClassroomPointsBrowseId } from "@/components/student/dashboard-v2/ClassroomPointsBrowseNav"

type HistoryPoint = {
  id: number
  points: number
  category: string
  awarded_at: string
  status?: string | null
  ai_feedback?: unknown
}

type LeaderboardEntry = {
  rank: number
  student_id?: number
  total_points: number
}

type StatTile = {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  thumbIndex: number
}

function buildCoraBriefing(args: {
  totalPoints: number
  maxPoints: number
  awardCount: number
  myRank: number | null
  gradePoints: string
  pointsRemaining: number
  provisionalCount: number
  openAssignments: number
  pendingReview: number
  recentAwards: number
  topCategoryLabel: string | null
  gapToNext: number | null
}) {
  const pct = args.maxPoints > 0 ? Math.round((args.totalPoints / args.maxPoints) * 100) : 0
  const title =
    pct >= 100
      ? "You've maxed the classroom runway"
      : pct >= 70
        ? "You're in the points power lane"
        : pct >= 40
          ? "Momentum is building — keep submitting"
          : args.awardCount === 0
            ? "Your classroom points story starts here"
            : "Solid start — time to stack awards"

  const lines: string[] = []
  lines.push(
    `You're at ${args.totalPoints.toFixed(1)} of ${args.maxPoints} classroom points (${args.gradePoints}/10 toward the grade scale) across ${args.awardCount} award${args.awardCount === 1 ? "" : "s"}.`,
  )
  if (args.myRank != null) {
    lines.push(
      args.myRank <= 3
        ? `Rank #${args.myRank} puts you on the podium — protect that lead with clean submissions.`
        : `You're ranked #${args.myRank}. ${
            args.gapToNext != null && args.gapToNext > 0
              ? `About ${args.gapToNext.toFixed(1)} pts separates you from the next spot.`
              : "Every approved submission climbs the board."
          }`,
    )
  }
  if (args.openAssignments > 0) {
    lines.push(
      `${args.openAssignments} open assignment${args.openAssignments === 1 ? "" : "s"} still waiting — that's the fastest path to more points.`,
    )
  }
  if (args.pendingReview > 0) {
    lines.push(
      `${args.pendingReview} submission${args.pendingReview === 1 ? "" : "s"} are in review — hang tight while your instructor grades.`,
    )
  }
  if (args.provisionalCount > 0) {
    lines.push(
      `${args.provisionalCount} provisional score${args.provisionalCount === 1 ? "" : "s"} may still change after instructor review.`,
    )
  }
  if (args.recentAwards > 0) {
    lines.push(`Nice streak energy: ${args.recentAwards} award${args.recentAwards === 1 ? "" : "s"} in the last 7 days.`)
  } else if (args.awardCount > 0) {
    lines.push("It's been a quiet week — one strong submission can restart the streak.")
  }
  if (args.topCategoryLabel) {
    lines.push(`Your strongest lane so far: ${args.topCategoryLabel}.`)
  }

  const tips: string[] = []
  if (args.openAssignments > 0) tips.push("Clear open solution or code assignments first — due dates beat leaderboard hunting.")
  if (args.pointsRemaining > 0) {
    tips.push(
      `You still need ${args.pointsRemaining.toFixed(1)} pts to lock the full ${args.maxPoints}-point grade contribution.`,
    )
  } else {
    tips.push("Full classroom points banked — use extras for rank and pride.")
  }
  if (args.myRank != null && args.myRank > 1) {
    tips.push("Check the leaderboard after each approval — small gaps close fast with boosters.")
  } else {
    tips.push("Presentations and participation awards stack on top of assignment points.")
  }

  return { title, narrative: lines.join(" "), tips: tips.slice(0, 3), pct }
}

const CATEGORY_SHORT: Record<string, string> = {
  code_submission: "Code",
  solution_submission: "Solutions",
  presentation: "Presentations",
  participation: "Participation",
  quiz_bonus: "Quiz bonus",
  extra_credit: "Extra credit",
  other: "Other",
}

export function ClassroomPointsOverviewPanel({
  totalPoints,
  maxPoints,
  awardCount,
  myRank,
  gradePoints,
  points,
  leaderboard,
  studentId,
  openCodeCount,
  openSolutionsCount,
  pendingReviewCount,
  cardVariant = "default",
  onNavigate,
}: {
  totalPoints: number
  maxPoints: number
  awardCount: number
  myRank: number | null
  gradePoints: string
  points: HistoryPoint[]
  leaderboard: LeaderboardEntry[]
  studentId: number
  openCodeCount: number
  openSolutionsCount: number
  pendingReviewCount: number
  cardVariant?: "default" | "inner"
  onNavigate: (id: ClassroomPointsBrowseId) => void
}) {
  const progressPct = maxPoints > 0 ? Math.min((totalPoints / maxPoints) * 100, 100) : 0
  const pointsRemaining = Math.max(0, maxPoints - totalPoints)
  const openAssignments = openCodeCount + openSolutionsCount

  const derived = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const recentAwards = points.filter((p) => new Date(p.awarded_at).getTime() >= weekAgo).length
    const provisionalCount = points.filter((p) => classroomPointIsProvisional(p)).length
    const byCat = new Map<string, number>()
    for (const p of points) {
      byCat.set(p.category, (byCat.get(p.category) || 0) + 1)
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
    const topCategoryLabel = top ? CATEGORY_SHORT[top[0]] || top[0] : null
    const categoryBars = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: CATEGORY_SHORT[key] || key,
        count,
        pct: awardCount > 0 ? Math.round((count / awardCount) * 100) : 0,
      }))

    const me = leaderboard.find((e) => e.student_id === studentId)
    const nextUp =
      myRank != null && myRank > 1
        ? leaderboard.find((e) => e.rank === myRank - 1)
        : null
    const gapToNext =
      me && nextUp ? Math.max(0, Number(nextUp.total_points) - Number(me.total_points)) : null

    const avgPerAward = awardCount > 0 ? totalPoints / awardCount : 0

    return {
      recentAwards,
      provisionalCount,
      topCategoryLabel,
      categoryBars,
      gapToNext,
      avgPerAward,
    }
  }, [points, awardCount, leaderboard, studentId, myRank, totalPoints])

  const briefing = useMemo(
    () =>
      buildCoraBriefing({
        totalPoints,
        maxPoints,
        awardCount,
        myRank,
        gradePoints,
        pointsRemaining,
        provisionalCount: derived.provisionalCount,
        openAssignments,
        pendingReview: pendingReviewCount,
        recentAwards: derived.recentAwards,
        topCategoryLabel: derived.topCategoryLabel,
        gapToNext: derived.gapToNext,
      }),
    [
      totalPoints,
      maxPoints,
      awardCount,
      myRank,
      gradePoints,
      pointsRemaining,
      derived.provisionalCount,
      derived.recentAwards,
      derived.topCategoryLabel,
      derived.gapToNext,
      openAssignments,
      pendingReviewCount,
    ],
  )

  const tiles: StatTile[] = [
    {
      label: "Total points",
      value: totalPoints.toFixed(1),
      hint: `of ${maxPoints}`,
      icon: Trophy,
      thumbIndex: 0,
    },
    {
      label: "Grade scale",
      value: `${gradePoints}/10`,
      hint: pointsRemaining > 0 ? `${pointsRemaining.toFixed(1)} pts to full` : "Full credit banked",
      icon: Target,
      thumbIndex: 1,
    },
    {
      label: "Awards",
      value: String(awardCount),
      hint: derived.recentAwards > 0 ? `${derived.recentAwards} this week` : "Lifetime this week",
      icon: Gift,
      thumbIndex: 2,
    },
    {
      label: "Class rank",
      value: myRank != null ? `#${myRank}` : "—",
      hint:
        derived.gapToNext != null && derived.gapToNext > 0
          ? `${derived.gapToNext.toFixed(1)} pts to next`
          : myRank === 1
            ? "Holding 1st"
            : "Climb the board",
      icon: TrendingUp,
      thumbIndex: 3,
    },
    {
      label: "Open work",
      value: String(openAssignments),
      hint: `${openCodeCount} code · ${openSolutionsCount} solutions`,
      icon: PenLine,
      thumbIndex: 4,
    },
    {
      label: "In review",
      value: String(pendingReviewCount),
      hint: pendingReviewCount > 0 ? "Awaiting instructor" : "Nothing pending",
      icon: Clock,
      thumbIndex: 5,
    },
    {
      label: "Provisional",
      value: String(derived.provisionalCount),
      hint: derived.provisionalCount > 0 ? "May still change" : "All final",
      icon: Flame,
      thumbIndex: 6,
    },
    {
      label: "Avg / award",
      value: derived.avgPerAward.toFixed(1),
      hint: "Points per award",
      icon: BarChart3,
      thumbIndex: 7,
    },
  ]

  const rankBadge =
    myRank === 1 ? (
      <Badge className="bg-amber-500 dark:bg-amber-600 text-amber-950 font-semibold text-xs px-2.5 py-1 rounded-lg">
        <Crown className="h-3.5 w-3.5 mr-1" />
        1st Place
      </Badge>
    ) : myRank === 2 ? (
      <Badge className="bg-slate-400 dark:bg-slate-500 text-white font-semibold text-xs px-2.5 py-1 rounded-lg">
        <Medal className="h-3.5 w-3.5 mr-1" />
        2nd Place
      </Badge>
    ) : myRank === 3 ? (
      <Badge className="bg-amber-700 dark:bg-amber-800 text-amber-100 font-semibold text-xs px-2.5 py-1 rounded-lg">
        <Medal className="h-3.5 w-3.5 mr-1" />
        3rd Place
      </Badge>
    ) : myRank != null ? (
      <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-lg border-[var(--border)]">
        #{myRank}
      </Badge>
    ) : null

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Progress — lives inside Overview pane (not above Browse) */}
      <CardWrapper variant={cardVariant} delay={0} hover={false}>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Your progress
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] transition-colors"
                        aria-label="How classroom points work"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm p-4">
                      <div className="space-y-2">
                        <div className="font-semibold mb-2 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          How to max out ({maxPoints} pts = 10/10)
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Submit classroom code and solution assignments</li>
                          <li>Present in class and participate</li>
                          <li>Use CodeBench classroom submissions when available</li>
                          <li>Watch for point boosters near due dates</li>
                        </ol>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className={cn("text-3xl sm:text-4xl font-bold tabular-nums tracking-tight", PORTAL_TEXT)}>
                  {totalPoints.toFixed(1)}
                </span>
                <span className={cn("text-sm sm:text-base", PORTAL_TEXT_MUTED)}>
                  / {maxPoints} pts · {gradePoints}/10 grade
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Star className="h-6 w-6 fill-[var(--cc-accent)] text-[var(--cc-accent)]" />
              {rankBadge}
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <motion.div
              className="h-full rounded-full bg-[var(--cc-accent)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>
            {briefing.pct}% of the classroom points runway · {awardCount} awards earned
          </p>
        </div>
      </CardWrapper>

      {/* Cora creative briefing */}
      <CardWrapper variant={cardVariant} delay={0.05} hover={false}>
        <div className="relative overflow-hidden p-4 sm:p-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{
              background:
                "radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--cc-accent) 18%, transparent), transparent 55%)",
            }}
          />
          <div className="relative space-y-4">
            <div className="flex items-start gap-3">
              <SolidListThumbTile thumb={solidListThumb(0)} icon={Sparkles} size="compact" />
              <div className="min-w-0 flex-1">
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Cora · Classroom Points
                </p>
                <h3 className={cn("mt-0.5 text-lg sm:text-xl font-semibold leading-snug", PORTAL_TEXT)}>
                  {briefing.title}
                </h3>
              </div>
            </div>
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{briefing.narrative}</p>
            <ul className="space-y-2">
              {briefing.tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5"
                >
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" />
                  <span className={cn("text-sm", PORTAL_TEXT)}>{tip}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {openSolutionsCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn("rounded-xl gap-1.5", PORTAL_CTA)}
                  onClick={() => onNavigate("solutions")}
                >
                  Open solutions
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
              {openCodeCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn("rounded-xl gap-1.5", PORTAL_OUTLINE_BTN)}
                  onClick={() => onNavigate("code")}
                >
                  Code assignments
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn("rounded-xl gap-1.5", PORTAL_OUTLINE_BTN)}
                onClick={() => onNavigate("history")}
              >
                Points history
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn("rounded-xl gap-1.5", PORTAL_OUTLINE_BTN)}
                onClick={() => onNavigate("leaderboard")}
              >
                Leaderboard
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardWrapper>

      {/* Expanded stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const thumb = solidListThumb(tile.thumbIndex)
          return (
            <CardWrapper key={tile.label} variant={cardVariant} delay={0.08 + tile.thumbIndex * 0.02}>
              <div className="p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className={cn("text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                      {tile.label}
                    </p>
                    <p className={cn("text-xl sm:text-2xl font-bold tabular-nums tracking-tight", PORTAL_TEXT)}>
                      {tile.value}
                    </p>
                    {tile.hint ? (
                      <p className={cn("text-[11px] leading-snug", PORTAL_TEXT_MUTED)}>{tile.hint}</p>
                    ) : null}
                  </div>
                  <SolidListThumbTile thumb={thumb} icon={Icon} size="compact" />
                </div>
              </div>
            </CardWrapper>
          )
        })}
      </div>

      {/* Category mix + next actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <CardWrapper variant={cardVariant} delay={0.2}>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[var(--cc-accent-dark)]" />
              <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Award mix</h4>
            </div>
            {derived.categoryBars.length === 0 ? (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No awards yet — submit to start the mix.</p>
            ) : (
              <div className="space-y-3">
                {derived.categoryBars.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={PORTAL_TEXT}>{row.label}</span>
                      <span className={cn("tabular-nums", PORTAL_TEXT_MUTED)}>
                        {row.count} · {row.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--cc-accent)]"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardWrapper>

        <CardWrapper variant={cardVariant} delay={0.22}>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--cc-accent-dark)]" />
              <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>This week</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3">
                <p className={cn("text-2xl font-bold tabular-nums", PORTAL_TEXT)}>{derived.recentAwards}</p>
                <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Awards (7d)</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3">
                <p className={cn("text-2xl font-bold tabular-nums", PORTAL_TEXT)}>{openAssignments}</p>
                <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Still open</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3">
                <p className={cn("text-2xl font-bold tabular-nums", PORTAL_TEXT)}>{pendingReviewCount}</p>
                <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>In review</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3">
                <p className={cn("text-2xl font-bold tabular-nums", PORTAL_TEXT)}>
                  {derived.gapToNext != null ? derived.gapToNext.toFixed(1) : "—"}
                </p>
                <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Pts to next rank</p>
              </div>
            </div>
          </div>
        </CardWrapper>
      </div>
    </div>
  )
}
