"use client"

import { FolderKanban, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const projectsChrome = facultyEmbedChrome("projects")
const projectsFamily = projectsChrome.theme.family

export function ProjectOverviewCard({
  rank,
  index = 0,
  title,
  groupName,
  session,
  leaderName,
  status,
  totalScore,
  studentVotes,
  studentPoints,
  instructorVotes,
  instructorPoints,
}: {
  rank: number
  index?: number
  title: string
  groupName: string
  session: string
  leaderName: string
  status: string
  totalScore: number
  studentVotes: number
  studentPoints: number
  instructorVotes: number
  instructorPoints: number
}) {
  const stripe = portalListStripe(index, projectsFamily)
  return (
    <article className="overflow-hidden px-3 py-3 transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
            stripe.iconBg,
            stripe.iconText,
          )}
        >
          #{rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{title}</h3>
            {status === "approved" ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                Approved
              </span>
            ) : null}
          </div>
          <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>
            {groupName} · {session} · {leaderName}
          </p>
        </div>
        <p className={cn("shrink-0 text-lg font-semibold tabular-nums", PORTAL_TEXT)}>
          {totalScore.toFixed(1)}
          <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}> / 50</span>
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className={cn("inline-flex items-center gap-1", PORTAL_TEXT_MUTED)}>
              <Users className="h-3 w-3" />
              Students ({studentVotes})
            </span>
            <span className={cn("tabular-nums", PORTAL_TEXT)}>{studentPoints.toFixed(1)} / 30</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)]"
              style={{ width: `${Math.min(100, (studentPoints / 30) * 100)}%` }}
            />
          </div>
          {studentVotes < 30 ? (
            <p className={cn("mt-1 text-[11px]", PORTAL_TEXT_MUTED)}>Need {30 - studentVotes} more votes</p>
          ) : null}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className={PORTAL_TEXT_MUTED}>Instructor</span>
            <span className={cn("tabular-nums", PORTAL_TEXT)}>{instructorPoints.toFixed(1)} / 20</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)]"
              style={{ width: `${Math.min(100, (instructorPoints / 20) * 100)}%` }}
            />
          </div>
          {instructorVotes === 0 ? (
            <p className={cn("mt-1 text-[11px]", PORTAL_TEXT_MUTED)}>Rating needed</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function ProjectScoreListCard({
  index = 0,
  layout = "list",
  title,
  meta,
  scored,
  votes,
  totalScore,
  onSelect,
}: {
  index?: number
  layout?: "card" | "list"
  title: string
  meta: string
  scored: boolean
  votes?: number
  totalScore?: number
  onSelect: () => void
}) {
  const stripe = portalListStripe(index, projectsFamily)
  return (
    <article
      className={cn(
        "overflow-hidden text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45",
        layout === "card" && "rounded-2xl border border-[var(--border)] bg-[var(--card)]",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              stripe.iconBg,
            )}
          >
            <FolderKanban className={cn("h-5 w-5", stripe.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={cn("line-clamp-2 text-sm font-semibold", PORTAL_TEXT)}>{title}</h3>
            <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>{meta}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {scored ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Scored
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Not scored
                </span>
              )}
              {votes != null ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {votes} votes
                </span>
              ) : null}
              {totalScore != null ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {totalScore.toFixed(1)}/50
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            Score
          </span>
        </div>
      </button>
    </article>
  )
}

export function ProjectLeaderboardCard({
  rank,
  index = 0,
  title,
  groupName,
  session,
  studentPoints,
  instructorPoints,
  totalScore,
}: {
  rank: number
  index?: number
  title: string
  groupName: string
  session?: string
  studentPoints: number
  instructorPoints: number
  totalScore: number
}) {
  const stripe = portalListStripe(index, projectsFamily)
  return (
    <article className="overflow-hidden px-3 py-3 transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
            stripe.iconBg,
            stripe.iconText,
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{title}</p>
          <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
            {groupName}
            {session ? ` · ${session}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{totalScore.toFixed(1)}</p>
          <p className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
            {studentPoints.toFixed(0)} student · {instructorPoints.toFixed(0)} faculty
          </p>
        </div>
      </div>
    </article>
  )
}

export function ProjectGradeListCard({
  index = 0,
  name,
  meta,
  score,
  letter,
  percent,
  hasOverride,
  onSelect,
}: {
  index?: number
  name: string
  meta: string
  score: number
  letter: string
  percent: number
  hasOverride: boolean
  onSelect: () => void
}) {
  const stripe = portalListStripe(index, projectsFamily)
  return (
    <article className="overflow-hidden text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <button type="button" onClick={onSelect} className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              stripe.iconBg,
            )}
          >
            <Users className={cn("h-5 w-5", stripe.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{name}</h3>
            <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>{meta}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {score.toFixed(1)} / 50
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {percent.toFixed(0)}% {letter}
              </span>
              {hasOverride ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Override
                </span>
              ) : null}
            </div>
          </div>
          <p className={cn("shrink-0 text-lg font-semibold tabular-nums", PORTAL_TEXT)}>
            {score.toFixed(1)}
          </p>
        </div>
      </button>
    </article>
  )
}
