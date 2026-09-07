"use client"

import Link from "next/link"
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  ListChecks,
  MessageSquare,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  CODEBENCH_CHIP,
  CODEBENCH_HEADER_WASH,
  CODEBENCH_INSET,
  CODEBENCH_PANEL,
} from "@/lib/codebench/codebench-surface-classes"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { CodebenchChallengeSkeleton } from "@/components/codebench/CodebenchSkeletons"
import { parseChallengePresentation } from "@/lib/codebench-challenge-format"
import type { CodebenchChallengeHandoff } from "@/lib/codebench-challenge-handoff"
import { cn } from "@/lib/utils"

type Props = {
  challenge: CodebenchChallengeHandoff | null
  loading?: boolean
  className?: string
  onAskCora?: () => void
  onSolve?: () => void
  solveHref?: string
  askCoraHref?: string
}

function difficultyClass(difficulty: string | undefined) {
  const d = (difficulty || "Medium").toLowerCase()
  if (d === "easy") return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  if (d === "hard") return "bg-red-500/12 text-red-700 dark:text-red-300"
  return "bg-amber-500/12 text-amber-800 dark:text-amber-300"
}

export function DailyChallengeCard({
  challenge,
  loading,
  className,
  onAskCora,
  onSolve,
  solveHref,
  askCoraHref,
}: Props) {
  const { accent, roles } = useCodebenchChrome()
  const presentation = challenge ? parseChallengePresentation(challenge.description) : null

  if (loading) {
    return <CodebenchChallengeSkeleton className={className} />
  }

  if (!challenge || !presentation) {
    return (
      <div className={cn("flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center", CODEBENCH_PANEL, className)}>
        <SolidListThumbTile thumb={roles.challenge} icon={Target} />
        <div>
          <h3 className="font-semibold text-[var(--cc-text)]">No challenge yet</h3>
          <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
            Refresh the hub — Cora will assign today’s problem.
          </p>
        </div>
      </div>
    )
  }

  const solveButton = (
    <Button
      className="h-11 gap-2 rounded-xl border-0 shadow-sm hover:opacity-90"
      style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
      onClick={onSolve}
      asChild={Boolean(solveHref && !onSolve)}
    >
      {solveHref && !onSolve ? (
        <Link href={solveHref}>
          <Code2 className="h-4 w-4" />
          Solve in workspace
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <>
          <Code2 className="h-4 w-4" />
          Solve in workspace
          <ChevronRight className="h-4 w-4" />
        </>
      )}
    </Button>
  )

  const askButton = (
    <Button
      variant="outline"
      className="h-11 gap-2 rounded-xl"
      onClick={onAskCora}
      asChild={Boolean(askCoraHref && !onAskCora)}
    >
      {askCoraHref && !onAskCora ? (
        <Link href={askCoraHref}>
          <MessageSquare className="h-4 w-4" />
          Ask Cora
        </Link>
      ) : (
        <>
          <MessageSquare className="h-4 w-4" />
          Ask Cora
        </>
      )}
    </Button>
  )

  return (
    <div className={cn("overflow-hidden", CODEBENCH_PANEL, className)}>
      <div className={cn("px-5 py-4", CODEBENCH_HEADER_WASH)}>
        <div className="flex min-w-0 items-start gap-3">
          <SolidListThumbTile thumb={roles.challenge} icon={Target} size="compact" />
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              Daily challenge
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-[var(--cc-text)] sm:text-xl">
              {challenge.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  difficultyClass(challenge.difficulty),
                )}
              >
                {challenge.difficulty || "Medium"}
              </span>
              <span className={CODEBENCH_CHIP}>
                <Zap className="h-3 w-3" style={{ color: accent }} />
                {challenge.xpReward ?? 10} XP
              </span>
              {presentation.timeHint ? (
                <span className={CODEBENCH_CHIP}>
                  <Clock3 className="h-3 w-3" />
                  {presentation.timeHint}
                </span>
              ) : null}
              {challenge.completed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Done today
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className={cn("px-4 py-3", CODEBENCH_INSET)}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
            <Sparkles className="h-3 w-3" />
            Goal
          </p>
          <p className="text-sm leading-relaxed text-[var(--cc-text)]">{presentation.goal}</p>
        </div>

        {presentation.requirements.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
              <ListChecks className="h-3.5 w-3.5" />
              Requirements
            </p>
            <ol className="grid gap-2">
              {presentation.requirements.map((req, index) => (
                <li
                  key={`${index}-${req.slice(0, 24)}`}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-2.5",
                    CODEBENCH_INSET,
                  )}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: "color-mix(in srgb, var(--cc-accent-soft) 45%, var(--card))",
                      color: accent,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-snug text-[var(--cc-text)]">{req}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {presentation.extras.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {presentation.extras.map((extra) => (
              <div
                key={extra.title}
                className={cn("px-3 py-2.5", CODEBENCH_INSET)}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  {extra.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-secondary)] line-clamp-4">
                  {extra.body}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {solveButton}
          {askButton}
        </div>
      </div>
    </div>
  )
}
