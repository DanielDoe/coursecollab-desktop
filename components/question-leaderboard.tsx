"use client"

import { Trophy, Medal, Award, Clock, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface LeaderboardEntry {
  rank: number
  displayName: string
  timeTaken: number
  responseTimeMs?: number
  points?: number
  isCorrect?: boolean
  is_current_user?: boolean
}

interface QuestionLeaderboardProps {
  entries: LeaderboardEntry[]
  isLoading?: boolean
}

export function QuestionLeaderboard({
  entries,
  isLoading = false,
}: QuestionLeaderboardProps) {
  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇"
      case 2:
        return "🥈"
      case 3:
        return "🥉"
      default:
        return null
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-amber-500" />
      case 2:
        return <Medal className="h-5 w-5 text-slate-400" />
      case 3:
        return <Award className="h-5 w-5 text-orange-600" />
      default:
        return (
          <span className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {rank}
          </span>
        )
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04] sm:rounded-3xl">
      <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.08] sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 dark:bg-orange-500/15">
            <Trophy className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">
              Question Leaderboard
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rankings for this question
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Waiting for answers…
          </p>
        ) : (
          <div className="max-h-[280px] space-y-2 overflow-y-auto sm:max-h-[320px]">
            {entries.map((entry, index) => {
              const isCurrentUser = Boolean(entry.is_current_user)

              return (
                <motion.div
                  key={`${entry.rank}-${index}`}
                  initial={{ x: -12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors sm:px-4 sm:py-3",
                    isCurrentUser
                      ? "border-orange-300/80 bg-orange-50/80 dark:border-orange-500/30 dark:bg-orange-950/25"
                      : entry.rank <= 3
                        ? "border-slate-200/70 bg-slate-50/80 dark:border-white/[0.08] dark:bg-white/[0.03]"
                        : "border-slate-200/60 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.02]",
                  )}
                >
                  <div className="flex w-10 shrink-0 items-center justify-center">
                    {entry.rank <= 3 ? (
                      <span className="text-2xl">{getRankEmoji(entry.rank)}</span>
                    ) : (
                      getRankIcon(entry.rank)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {entry.displayName}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                          (You)
                        </span>
                      )}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {entry.isCorrect === false && (
                        <span className="text-red-500 dark:text-red-400">Incorrect</span>
                      )}
                      {(entry.responseTimeMs != null || entry.timeTaken != null) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {entry.responseTimeMs
                            ? `${(entry.responseTimeMs / 1000).toFixed(1)}s`
                            : `${entry.timeTaken}s`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/90 px-2.5 py-1 dark:bg-white/[0.06]">
                      <Zap className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {entry.points ?? 0}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">pts</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
