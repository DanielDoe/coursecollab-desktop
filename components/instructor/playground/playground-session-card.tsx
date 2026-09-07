"use client"

import { ArrowRight, Clock, Gamepad2, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

const playgroundChrome = facultyEmbedChrome("playground")

export type PlaygroundSessionCardData = {
  id: number
  sessionCode: string
  label: string
  isActive: boolean
  gameStarted?: boolean
  questionCount: number
  durationSec: number
  lobbyCount: number
  createdAt: string
  topics?: string[] | null
}

function StatusPill({ isActive, gameStarted }: { isActive: boolean; gameStarted?: boolean }) {
  if (isActive && gameStarted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    )
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Waiting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Closed
    </span>
  )
}

export function PlaygroundSessionCard({
  sessionCode,
  label,
  isActive,
  gameStarted,
  questionCount,
  durationSec,
  lobbyCount,
  createdAt,
  topics,
  onSelect,
}: PlaygroundSessionCardData & { onSelect: () => void }) {
  const topicPreview = (topics ?? []).slice(0, 2).join(" · ")
  const created = new Date(createdAt)
  const createdLabel = Number.isNaN(created.getTime())
    ? ""
    : created.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex gap-3 p-3 pb-2.5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm",
              playgroundChrome.p.softBg,
            )}
          >
            <Gamepad2 className={cn("h-5 w-5", playgroundChrome.p.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--cc-text)]">{label}</h3>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{sessionCode}</p>
            {topicPreview ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">{topicPreview}</p>
            ) : null}
            <div className="mt-2">
              <StatusPill isActive={isActive} gameStarted={gameStarted} />
            </div>
          </div>
        </div>
        <div className="mx-3 border-t border-[var(--border)]/70" />
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {lobbyCount}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {questionCount} · {durationSec}s
            </span>
            {createdLabel ? (
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">{createdLabel}</span>
            ) : null}
          </div>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              playgroundChrome.p.softBg,
              playgroundChrome.p.iconText,
            )}
          >
            Open session
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </article>
  )
}
