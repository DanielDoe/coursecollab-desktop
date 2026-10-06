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
  rankLabelClass: string
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
  rankLabelClass,
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
                  "rounded-full p-2.5 sm:p-3 ring-4 ring-[var(--border)]",
                  medalClass,
                )}
              >
                <MedalIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
              </div>
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
                    ? "bg-[var(--cc-accent)] text-white"
                    : "border border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text)]",
                )}
              >
                {podiumInitials(displayName ?? "?")}
              </div>
              <p className="mt-2 max-w-full line-clamp-2 text-xs font-semibold leading-snug text-[var(--cc-text)] sm:text-sm">
                {displayName}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--cc-accent)] sm:text-base">
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)] text-xs text-[var(--cc-text-muted)]">
              —
            </div>
            <p className="mt-2 text-xs text-[var(--cc-text-muted)]">No #{rank}</p>
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
          "relative w-full overflow-hidden rounded-t-xl border border-b-0 border-[var(--border)] sm:rounded-t-2xl",
          platformHeight,
          platformClass,
        )}
      >
        <div className="absolute bottom-3 left-0 right-0 text-center sm:bottom-4">
          <span className={cn("text-xl font-black sm:text-2xl", rankLabelClass)}>#{rank}</span>
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
      platformClass: "bg-[var(--muted)]",
      platformHeight: "h-20 sm:h-24 md:h-28",
      platformDelay: 0.15,
      medalDelay: 0.55,
      MedalIcon: Medal,
      medalClass: "border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
      rankLabelClass: "text-[var(--cc-text)]",
    },
    {
      rank: 1,
      entry: byRank(1),
      platformClass: "bg-[var(--cc-accent)]",
      platformHeight: "h-32 sm:h-36 md:h-40",
      platformDelay: 0,
      medalDelay: 0.35,
      MedalIcon: Crown,
      medalClass: "bg-[var(--cc-accent)] text-white",
      rankLabelClass: "text-white",
    },
    {
      rank: 3,
      entry: byRank(3),
      platformClass: "bg-[var(--cc-accent-soft)]",
      platformHeight: "h-16 sm:h-20 md:h-24",
      platformDelay: 0.25,
      medalDelay: 0.7,
      MedalIcon: Medal,
      medalClass: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
      rankLabelClass: "text-[var(--cc-accent-dark)]",
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
    >
      <div className="relative px-3 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-5 md:px-8">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-[var(--cc-text-muted)] sm:mb-6"
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
              "mt-3 text-center text-xs text-[var(--cc-text-muted)]",
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
