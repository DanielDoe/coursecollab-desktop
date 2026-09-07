"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Crown, Medal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlaygroundPodiumEntry } from "@/lib/playground-podium"
import { firePlaygroundPodiumConfetti } from "@/lib/playground-podium-confetti"

function podiumInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

type PodiumSlotConfig = {
  rank: 1 | 2 | 3
  entry: PlaygroundPodiumEntry | undefined
  platformClass: string
  platformHeight: string
  platformDelay: number
  medalDelay: number
  MedalIcon: typeof Crown | typeof Medal
  medalClass: string
}

function PodiumSlot({
  rank,
  entry,
  platformClass,
  platformHeight,
  platformDelay,
  medalDelay,
  MedalIcon,
  medalClass,
}: PodiumSlotConfig) {
  const displayName = entry ? entry.studentName || entry.displayName : null

  return (
    <div className="flex flex-col items-center w-[30%] max-w-[150px] sm:max-w-[175px] md:max-w-[200px]">
      <div className="relative flex flex-col items-center w-full mb-3 min-h-[104px] sm:min-h-[120px] md:min-h-[128px]">
        {entry ? (
          <>
            <motion.div
              initial={{ y: -48, opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                delay: medalDelay,
                type: "spring",
                stiffness: 420,
                damping: 14,
              }}
              className="relative z-20 mb-1"
            >
              <div
                className={cn(
                  "rounded-full p-2.5 sm:p-3 shadow-lg ring-4 ring-white/25 dark:ring-white/15 dark:shadow-black/30",
                  medalClass,
                )}
              >
                <MedalIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ delay: medalDelay + 0.2, duration: 0.8 }}
                className="absolute inset-0 rounded-full bg-white/40 dark:bg-amber-300/25 blur-md -z-10"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: medalDelay + 0.15, duration: 0.35 }}
              className="flex flex-col items-center text-center px-1"
            >
              <div
                className={cn(
                  "flex h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 items-center justify-center rounded-full text-xs sm:text-sm font-bold shadow-md",
                  rank === 1
                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/30"
                    : "bg-slate-200 dark:bg-white/12 text-slate-800 dark:text-slate-100 border border-slate-300/50 dark:border-white/10",
                )}
              >
                {podiumInitials(displayName ?? "?")}
              </div>
              <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug max-w-full">
                {displayName}
              </p>
              <p className="text-sm sm:text-base font-bold tabular-nums text-violet-600 dark:text-violet-300 mt-0.5">
                {entry.score} pts
              </p>
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: platformDelay + 0.3 }}
            className="flex flex-col items-center justify-end h-full pb-1"
          >
            <div className="h-9 w-9 rounded-full border-2 border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-400 text-xs">
              —
            </div>
            <p className="text-xs text-slate-400 mt-2">No #{rank}</p>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{
          delay: platformDelay,
          duration: 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ transformOrigin: "bottom" }}
        className={cn(
          "w-full rounded-t-xl sm:rounded-t-2xl shadow-lg dark:shadow-black/40 relative overflow-hidden",
          platformHeight,
          platformClass,
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 dark:from-black/35 to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-2 right-2 h-1 rounded-full bg-white/30 dark:bg-white/20" />
        <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 text-center">
          <span className="text-xl sm:text-2xl font-black text-white/95 drop-shadow-sm">#{rank}</span>
        </div>
      </motion.div>
    </div>
  )
}

export function PlaygroundLeaderboardPodium({
  entries,
  listRevealed = true,
  revealHint = "Revealing full leaderboard…",
  celebrationKey,
}: {
  entries: PlaygroundPodiumEntry[]
  listRevealed?: boolean
  revealHint?: string
  /** When this changes (e.g. session id), confetti runs once for the new podium. */
  celebrationKey?: string
}) {
  const byRank = (r: number) => entries.find((e) => e.rank === r)
  const celebratedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!celebrationKey) return
    if (!entries.some((e) => e.rank === 1)) return
    if (celebratedRef.current === celebrationKey) return
    celebratedRef.current = celebrationKey

    firePlaygroundPodiumConfetti(
      entries.some((e) => e.rank === 2),
      entries.some((e) => e.rank === 3),
    )
  }, [celebrationKey, entries])

  const slots: PodiumSlotConfig[] = [
    {
      rank: 2,
      entry: byRank(2),
      platformClass: "bg-gradient-to-b from-slate-300 to-slate-500 dark:from-slate-400 dark:to-slate-600",
      platformHeight: "h-20 sm:h-24 md:h-28",
      platformDelay: 0.15,
      medalDelay: 0.55,
      MedalIcon: Medal,
      medalClass:
        "bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-300 dark:to-slate-500 text-slate-700 dark:text-slate-900",
    },
    {
      rank: 1,
      entry: byRank(1),
      platformClass: "bg-gradient-to-b from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-700",
      platformHeight: "h-32 sm:h-36 md:h-40",
      platformDelay: 0,
      medalDelay: 0.35,
      MedalIcon: Crown,
      medalClass:
        "bg-gradient-to-br from-amber-300 to-yellow-500 dark:from-amber-400 dark:to-yellow-500 text-amber-950",
    },
    {
      rank: 3,
      entry: byRank(3),
      platformClass: "bg-gradient-to-b from-amber-600 to-amber-800 dark:from-amber-700 dark:to-amber-900",
      platformHeight: "h-16 sm:h-20 md:h-24",
      platformDelay: 0.25,
      medalDelay: 0.7,
      MedalIcon: Medal,
      medalClass:
        "bg-gradient-to-br from-amber-500 to-amber-800 dark:from-amber-600 dark:to-amber-700 text-amber-50",
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative rounded-2xl border border-slate-200/80 dark:border-white/[0.1] bg-gradient-to-b from-slate-100/90 via-white to-slate-50/60 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-slate-950/20 overflow-x-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.5, 0.2] }}
          transition={{ delay: 0.4, duration: 1.2 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-amber-400/20 dark:bg-amber-500/15 blur-3xl"
        />
      </div>

      <div className="relative px-3 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-5 md:px-8">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-5 sm:mb-6"
        >
          Top performers
        </motion.p>

        <div className="flex items-end justify-center gap-1.5 sm:gap-3 md:gap-5 max-w-lg md:max-w-xl mx-auto pb-1 sm:pb-2">
          {slots.map((slot) => (
            <PodiumSlot key={slot.rank} {...slot} />
          ))}
        </div>

        {revealHint ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: listRevealed ? 0 : 1 }}
            transition={{ delay: 1.8, duration: 0.4 }}
            className={cn(
              "text-center text-xs text-slate-500 dark:text-slate-400 mt-3",
              listRevealed && "hidden",
            )}
          >
            {revealHint}
          </motion.p>
        ) : null}
      </div>
    </motion.div>
  )
}
