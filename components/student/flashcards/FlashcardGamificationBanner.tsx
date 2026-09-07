"use client"

import { useEffect, useState } from "react"
import { Flame, Medal, Target, Trophy, Zap } from "lucide-react"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import type {
  FlashcardGamificationProfile,
  FlashcardLeaderboardEntry,
} from "@/lib/flashcard-gamification"
import { cn } from "@/lib/utils"
import { FLASHCARD_MASTERY_INVALIDATE } from "@/components/student/flashcards/use-flashcard-deck-mastery"

type Props = {
  topicFilter?: string
  className?: string
}

export function FlashcardGamificationBanner({ topicFilter = "all", className }: Props) {
  const [profile, setProfile] = useState<FlashcardGamificationProfile | null>(null)
  const [leaderboard, setLeaderboard] = useState<FlashcardLeaderboardEntry[]>([])

  useEffect(() => {
    const qs =
      topicFilter && topicFilter !== "all"
        ? `?topic=${encodeURIComponent(topicFilter)}`
        : ""
    const load = () => {
      studentApiFetch(`/api/student/flashcards/gamification${qs}`, { headers: getStudentAuthHeaders() })
        .then((r) => r.json())
        .then((data) => {
          setProfile(data.profile ?? null)
          setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : [])
        })
        .catch(() => {
          setProfile(null)
          setLeaderboard([])
        })
    }

    load()
    window.addEventListener(FLASHCARD_MASTERY_INVALIDATE, load)
    return () => window.removeEventListener(FLASHCARD_MASTERY_INVALIDATE, load)
  }, [topicFilter])

  if (!profile) return null

  const dailyPct = Math.min(
    100,
    Math.round((profile.dailyProgress / profile.dailyGoal) * 100),
  )

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--sidebar-accent)]/20 p-4 sm:p-5",
        className,
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cc-accent)]/15 px-2.5 py-1 text-xs font-bold text-[var(--cc-accent)]">
              <Medal className="h-3.5 w-3.5" />
              Lv {profile.level.level} · {profile.level.title}
            </span>
            {profile.dailyStreakDays > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <Flame className="h-3.5 w-3.5" />
                {profile.dailyStreakDays}-day streak
              </span>
            ) : null}
            <span className="text-xs text-[var(--cc-text-muted)]">
              {profile.totalMastered} cards mastered lifetime
            </span>
          </div>

          {profile.level.nextLevelAt != null ? (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--cc-text-muted)]">
                <span>Level progress</span>
                <span>
                  {profile.totalMastered} / {profile.level.nextLevelAt}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                <div
                  className="h-full rounded-full bg-[var(--cc-accent)] transition-all"
                  style={{ width: `${profile.level.progressToNext}%` }}
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-[var(--cc-text)]">
                <Target className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
                Daily goal
              </span>
              <span className="text-[var(--cc-text-muted)]">
                {profile.dailyProgress}/{profile.dailyGoal} cards
                {profile.dailyGoalMet ? " ✓" : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  profile.dailyGoalMet ? "bg-emerald-500" : "bg-[var(--cc-accent)]",
                )}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
        </div>

        {leaderboard.length > 0 ? (
          <div className="min-w-[200px] rounded-xl border border-[var(--border)]/80 bg-[var(--card)]/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--cc-text)]">
              <Trophy className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
              This week {topicFilter !== "all" ? `· ${topicFilter}` : ""}
            </p>
            <ol className="space-y-1">
              {leaderboard.slice(0, 5).map((entry) => (
                <li
                  key={entry.studentId}
                  className={cn(
                    "flex items-center justify-between text-xs",
                    entry.isCurrentUser && "font-semibold text-[var(--cc-accent)]",
                  )}
                >
                  <span>
                    #{entry.rank} {entry.displayName}
                    {entry.isCurrentUser ? " (you)" : ""}
                  </span>
                  <span className="tabular-nums text-[var(--cc-text-muted)]">
                    {entry.cardsMastered}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <p className="mt-3 flex items-center gap-1 text-[11px] text-[var(--cc-text-muted)]">
        <Zap className="h-3 w-3 text-[var(--cc-accent)]" />
        Try <strong className="font-medium text-[var(--cc-text)]">Timed Challenge</strong> or beat the{" "}
        <strong className="font-medium text-[var(--cc-text)]">Boss card</strong> for bonus XP in study mode.
      </p>
    </div>
  )
}
