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
  maxPoints = 50,
  instructorOnly = false,
  onSelect,
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
  maxPoints?: number
  instructorOnly?: boolean
  onSelect?: () => void
}) {
  const stripe = portalListStripe(index, projectsFamily)
  const shownScore = instructorOnly ? instructorPoints : totalScore
  const body = (
    <>
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
          {shownScore.toFixed(1)}
          <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}> / {maxPoints}</span>
        </p>
      </div>
      {instructorOnly ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className={PORTAL_TEXT_MUTED}>Instructor</span>
            <span className={cn("tabular-nums", PORTAL_TEXT)}>
              {instructorPoints.toFixed(1)} / {maxPoints}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)]"
              style={{ width: `${Math.min(100, (instructorPoints / Math.max(maxPoints, 0.01)) * 100)}%` }}
            />
          </div>
          {instructorVotes === 0 && instructorPoints <= 0 ? (
            <p className={cn("mt-1 text-[11px]", PORTAL_TEXT_MUTED)}>Grade needed · open report</p>
          ) : null}
        </div>
      ) : (
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
      )}
    </>
  )
  return (
    <article className="overflow-hidden transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      {onSelect ? (
        <button type="button" onClick={onSelect} className="w-full px-3 py-3 text-left">
          {body}
        </button>
      ) : (
        <div className="px-3 py-3">{body}</div>
      )}
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
  maxPoints = 50,
  actionLabel = "Score",
  onSelect,
}: {
  index?: number
  layout?: "card" | "list"
  title: string
  meta: string
  scored: boolean
  votes?: number
  totalScore?: number
  maxPoints?: number
  actionLabel?: string
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
        <div className="flex items-center gap-3">
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
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                  Scored
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Not scored
                </span>
              )}
              {votes != null ? (
                <span className={cn("rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT)}>
                  {votes} votes
                </span>
              ) : null}
            </div>
          </div>
          {totalScore != null ? (
            <div className="flex w-[5.5rem] shrink-0 flex-col items-end gap-1">
              <p className={cn("text-lg font-semibold leading-none tabular-nums", PORTAL_TEXT)}>
                {totalScore.toFixed(1)}
                <span className={cn("ml-0.5 text-xs font-medium", PORTAL_TEXT_MUTED)}>/{maxPoints}</span>
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--cc-accent)]"
                  style={{ width: `${Math.max(4, Math.min(100, maxPoints > 0 ? (totalScore / maxPoints) * 100 : 0))}%` }}
                />
              </div>
            </div>
          ) : null}
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            {actionLabel}
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
  breakdown,
}: {
  rank: number
  index?: number
  title: string
  groupName: string
  session?: string
  studentPoints: number
  instructorPoints: number
  totalScore: number
  breakdown?: string
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
            {breakdown ?? `${studentPoints.toFixed(0)} student · ${instructorPoints.toFixed(0)} faculty`}
          </p>
        </div>
      </div>
    </article>
  )
}

function letterChip(letter: string) {
  if (letter === "A") return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
  if (letter === "B") return "bg-sky-500/20 text-sky-800 dark:text-sky-200"
  if (letter === "C") return "bg-amber-500/20 text-amber-900 dark:text-amber-200"
  if (letter === "D") return "bg-orange-500/20 text-orange-900 dark:text-orange-200"
  return "bg-rose-500/20 text-rose-800 dark:text-rose-200"
}

export function ProjectGradeListCard({
  index = 0,
  name,
  meta,
  score,
  letter,
  percent,
  maxPoints = 20,
  hasOverride,
  onSelect,
}: {
  index?: number
  name: string
  meta: string
  score: number
  letter: string
  percent: number
  maxPoints?: number
  hasOverride: boolean
  onSelect: () => void
}) {
  const stripe = portalListStripe(index, projectsFamily)
  return (
    <article className="overflow-hidden text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <button type="button" onClick={onSelect} className="w-full p-3 text-left">
        <div className="flex items-center gap-3">
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
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", letterChip(letter))}>
                {percent.toFixed(0)}% {letter}
              </span>
              {hasOverride ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Override
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex w-[6.5rem] shrink-0 flex-col items-end gap-1">
            <p className={cn("text-lg font-semibold leading-none tabular-nums", PORTAL_TEXT)}>
              {score.toFixed(1)}
              <span className={cn("ml-0.5 text-xs font-medium", PORTAL_TEXT_MUTED)}>/{maxPoints}</span>
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
              />
            </div>
          </div>
        </div>
      </button>
    </article>
  )
}
