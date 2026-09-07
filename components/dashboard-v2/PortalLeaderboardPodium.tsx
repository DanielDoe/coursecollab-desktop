"use client"

import { motion } from "framer-motion"
import { Crown, Medal } from "lucide-react"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export type PortalPodiumEntry = {
  rank: number
  primaryLabel: string
  secondaryLabel?: string
  score: number
  /** Shown after score, e.g. "pts" or "/ 50" */
  scoreUnit?: string
  /** Extra line under score, e.g. "30 + 20" */
  scoreDetail?: string
}

function podiumInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

type PodiumSlotConfig = {
  rank: 1 | 2 | 3
  entry: PortalPodiumEntry | undefined
  platformClass: string
  platformHeight: string
  platformDelay: number
  medalDelay: number
  MedalIcon: typeof Crown | typeof Medal
  medalClass: string
  avatarClass: string
  scoreClass: string
  onSelect?: (entry: PortalPodiumEntry) => void
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
  avatarClass,
  scoreClass,
  onSelect,
}: PodiumSlotConfig) {
  const interactive = Boolean(entry && onSelect)

  return (
    <div className="flex w-[30%] max-w-[150px] flex-col items-center sm:max-w-[175px] md:max-w-[200px]">
      <div className="relative mb-3 flex min-h-[104px] w-full flex-col items-center sm:min-h-[120px] md:min-h-[128px]">
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
                  "rounded-full p-2.5 shadow-lg ring-4 ring-[var(--background)]/40 sm:p-3",
                  medalClass,
                )}
              >
                <MedalIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" aria-hidden />
              </div>
            </motion.div>

            <motion.button
              type="button"
              disabled={!interactive}
              onClick={() => entry && onSelect?.(entry)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: medalDelay + 0.15, duration: 0.35 }}
              className={cn(
                "flex w-full flex-col items-center px-1 text-center",
                interactive && "cursor-pointer rounded-lg transition-colors hover:bg-muted/40",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold shadow-md sm:h-11 sm:w-11 sm:text-sm md:h-12 md:w-12",
                  avatarClass,
                )}
              >
                {podiumInitials(entry.primaryLabel)}
              </div>
              <p
                className={cn(
                  "mt-2 line-clamp-2 max-w-full text-xs font-semibold leading-snug sm:text-sm",
                  PORTAL_TEXT,
                )}
              >
                {entry.primaryLabel}
              </p>
              {entry.secondaryLabel ? (
                <p className={cn("mt-0.5 line-clamp-1 max-w-full text-[11px]", PORTAL_TEXT_MUTED)}>
                  {entry.secondaryLabel}
                </p>
              ) : null}
              <p className={cn("mt-1 text-sm font-bold tabular-nums sm:text-base", scoreClass)}>
                {entry.score.toFixed(1)}
                {entry.scoreUnit ? (
                  <span className={cn("ml-0.5 text-xs font-medium", PORTAL_TEXT_MUTED)}>
                    {entry.scoreUnit}
                  </span>
                ) : null}
              </p>
              {entry.scoreDetail ? (
                <p className={cn("text-[10px] tabular-nums", PORTAL_TEXT_MUTED)}>{entry.scoreDetail}</p>
              ) : null}
            </motion.button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: platformDelay + 0.3 }}
            className="flex h-full flex-col items-center justify-end pb-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)] text-xs text-[var(--cc-text-muted)]">
              —
            </div>
            <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>No #{rank}</p>
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
          "relative w-full overflow-hidden rounded-t-xl shadow-lg sm:rounded-t-2xl",
          platformHeight,
          platformClass,
        )}
      >
        <div className="absolute left-2 right-2 top-2.5 h-1 rounded-full bg-white/35" />
        <div className="absolute bottom-3 left-0 right-0 text-center sm:bottom-4">
          <span className="text-xl font-black text-white/95 drop-shadow-sm sm:text-2xl">#{rank}</span>
        </div>
      </motion.div>
    </div>
  )
}

export function PortalLeaderboardPodium({
  entries,
  heading = "Top performers",
  className,
  onEntrySelect,
}: {
  entries: PortalPodiumEntry[]
  heading?: string
  className?: string
  onEntrySelect?: (entry: PortalPodiumEntry) => void
}) {
  const byRank = (r: number) => entries.find((e) => e.rank === r)

  const slots: PodiumSlotConfig[] = [
    {
      rank: 2,
      entry: byRank(2),
      platformClass: "bg-slate-400 dark:bg-slate-500",
      platformHeight: "h-20 sm:h-24 md:h-28",
      platformDelay: 0.15,
      medalDelay: 0.55,
      MedalIcon: Medal,
      medalClass: "bg-slate-300 !text-slate-800 dark:bg-slate-400 dark:!text-slate-900",
      avatarClass: "bg-slate-500 !text-white",
      scoreClass: "text-slate-600 dark:text-slate-300",
      onSelect: onEntrySelect,
    },
    {
      rank: 1,
      entry: byRank(1),
      platformClass: "bg-amber-500 dark:bg-amber-500",
      platformHeight: "h-32 sm:h-36 md:h-40",
      platformDelay: 0,
      medalDelay: 0.35,
      MedalIcon: Crown,
      medalClass: "bg-amber-400 !text-amber-950",
      avatarClass: "bg-amber-500 !text-white",
      scoreClass: "text-amber-700 dark:text-amber-400",
      onSelect: onEntrySelect,
    },
    {
      rank: 3,
      entry: byRank(3),
      platformClass: "bg-orange-600 dark:bg-orange-500",
      platformHeight: "h-16 sm:h-20 md:h-24",
      platformDelay: 0.25,
      medalDelay: 0.7,
      MedalIcon: Medal,
      medalClass: "bg-orange-500 !text-white",
      avatarClass: "bg-orange-600 !text-white",
      scoreClass: "text-orange-700 dark:text-orange-400",
      onSelect: onEntrySelect,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        PORTAL_CARD,
        "relative overflow-x-hidden",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.45, 0.15] }}
          transition={{ delay: 0.4, duration: 1.2 }}
          className="absolute left-1/2 top-4 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl"
        />
      </div>

      <div className="relative px-3 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-8 md:px-8">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-5 text-center text-xs font-semibold uppercase tracking-widest sm:mb-6",
            PORTAL_TEXT_MUTED,
          )}
        >
          {heading}
        </motion.p>

        <div className="mx-auto flex max-w-lg items-end justify-center gap-1.5 pb-1 sm:max-w-xl sm:gap-3 sm:pb-2 md:gap-5">
          {slots.map((slot) => (
            <PodiumSlot key={slot.rank} {...slot} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function buildPortalPodiumEntries<T>(
  rows: T[],
  mapRow: (row: T, rank: number) => PortalPodiumEntry,
): PortalPodiumEntry[] {
  return rows.slice(0, 3).map((row, index) => mapRow(row, index + 1))
}
