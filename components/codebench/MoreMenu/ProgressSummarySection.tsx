"use client"

import { Award, Flame, Send, Trophy, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { CodebenchProgressSummary } from "@/lib/codebench-progress"

interface ProgressSummarySectionProps {
  summary: CodebenchProgressSummary | null
  loading?: boolean
  embedInDashboard?: boolean
}

function Kpi({
  icon: Icon,
  label,
  value,
  embedInDashboard,
}: {
  icon: typeof Flame
  label: string
  value: string | number
  embedInDashboard?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 sm:px-3",
        embedInDashboard
          ? "border-[var(--border)] bg-[var(--muted)]/20"
          : "border-slate-700/50 bg-slate-800/40",
      )}
    >
      <Icon className={cn("h-4 w-4", embedInDashboard ? "text-[var(--cc-accent)]" : "text-blue-400")} />
      <div className={cn("text-lg font-bold tabular-nums", embedInDashboard ? PORTAL_TEXT : "text-white")}>
        {value}
      </div>
      <div className={cn("text-[10px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{label}</div>
    </div>
  )
}

export function ProgressSummarySection({
  summary,
  loading,
  embedInDashboard = true,
}: ProgressSummarySectionProps) {
  if (loading && !summary) {
    return (
      <div
        className={cn(
          "mb-5 space-y-3 rounded-xl border p-4",
          embedInDashboard ? "border-[var(--border)] bg-[var(--muted)]/15" : "border-slate-700 bg-slate-800/50",
        )}
        aria-busy
        aria-label="Loading progress"
      >
        <div className="h-4 w-28 animate-pulse rounded-md bg-[var(--muted)]" />
        <div className="h-2 w-full animate-pulse rounded-full bg-[var(--muted)]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--muted)]" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) return null

  const xpPct = Math.min(100, Math.round((summary.levelProgress / summary.xpToNextLevel) * 100))

  return (
    <section
      className={cn(
        "mb-5 space-y-4 rounded-xl border p-4 sm:p-5",
        embedInDashboard
          ? "border-[var(--border)] bg-[var(--sidebar-accent)]/10"
          : "border-slate-700/50 bg-slate-800/40",
      )}
      aria-label="CodeBench progress summary"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-semibold", PORTAL_TEXT)}>Level {summary.level}</span>
            <span className={cn("inline-flex items-center gap-1 text-xs", PORTAL_TEXT_MUTED)}>
              <Zap className="h-3.5 w-3.5 text-[#eaaa00]" />
              {summary.xp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]/50">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {summary.levelProgress} / {summary.xpToNextLevel} XP to next level
          </p>
        </div>

        {summary.proficiencyScore != null && (
          <div className="shrink-0 text-right">
            <div className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              Proficiency
            </div>
            <div className={cn("text-2xl font-bold tabular-nums", PORTAL_TEXT)}>
              {summary.proficiencyScore}%
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Kpi icon={Flame} label="Streak" value={summary.streak} embedInDashboard={embedInDashboard} />
        <Kpi icon={Award} label="Badges" value={summary.badgeCount} embedInDashboard={embedInDashboard} />
        <Kpi icon={Send} label="Submissions" value={summary.submissionCount} embedInDashboard={embedInDashboard} />
        <Kpi
          icon={Trophy}
          label="Rank"
          value={summary.rank != null ? `#${summary.rank}` : "—"}
          embedInDashboard={embedInDashboard}
        />
      </div>
    </section>
  )
}
