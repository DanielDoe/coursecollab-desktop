"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Award, Crown, Medal, Sparkles, Target, Trophy, Users, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { initialsFromName } from "@/lib/initials-from-name"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getStudentData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { CampXpDonutGauge } from "@/components/summer-camp/CampXpDonutGauge"
import {
  camperAccentText,
  camperBody,
  camperCard,
  camperHeading,
  camperHeroPanel,
  camperPageIcon,
} from "@/lib/summer-camp/camper-ui-theme"

export type LeaderboardEntry = {
  rank: number
  student_id: number
  name: string
  total_xp: number
  modules_completed: number
  badges_earned: number
  is_current_user: boolean
}

export type LeaderboardHub = {
  trainings: Array<{ id: number; title: string }>
  selected_training_id: number | null
  leaderboard: LeaderboardEntry[]
  current_user: LeaderboardEntry | null
  total_xp: number
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

function initials(name: string) {
  return initialsFromName(name)
}

function PodiumCard({
  entry,
  place,
  delay,
}: {
  entry: LeaderboardEntry
  place: 1 | 2 | 3
  delay: number
}) {
  const styles = {
    1: {
      ring: "ring-amber-400/50",
      bg: "bg-gradient-to-b from-amber-500/15 to-amber-500/5 border-amber-500/35",
      icon: Crown,
      iconClass: "text-amber-500",
      height: "sm:pt-8 sm:pb-6",
      scale: "sm:scale-105 sm:z-10",
    },
    2: {
      ring: "ring-slate-300/60 dark:ring-white/15",
      bg: "bg-gradient-to-b from-slate-100/80 to-slate-50/40 dark:from-white/[0.06] dark:to-white/[0.02] border-slate-300/50 dark:border-white/10",
      icon: Medal,
      iconClass: "text-slate-400",
      height: "sm:pt-4",
      scale: "",
    },
    3: {
      ring: "ring-orange-400/40",
      bg: "bg-gradient-to-b from-orange-500/10 to-orange-500/5 border-orange-500/30",
      icon: Medal,
      iconClass: "text-orange-600 dark:text-orange-400",
      height: "sm:pt-4",
      scale: "",
    },
  }[place]

  const Icon = styles.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-2xl border p-4 text-center transition-shadow hover:shadow-lg",
        styles.bg,
        styles.height,
        styles.scale,
        entry.is_current_user && "ring-2 ring-[var(--cc-accent-border)]",
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={cn("relative", place === 1 && "mb-1")}>
          <Avatar className={cn("border-2", place === 1 ? "size-14 sm:size-16" : "size-12", styles.ring)}>
            <AvatarFallback
              className={cn(
                "font-semibold text-white",
                place === 1 ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-violet-600 to-indigo-600",
              )}
            >
              {initials(entry.name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm",
              place === 1 ? "bg-amber-500" : place === 2 ? "bg-slate-400" : "bg-orange-500",
            )}
          >
            <Icon className={cn("h-3 w-3 text-white", place !== 1 && styles.iconClass)} />
          </span>
        </div>
        <div className="min-w-0 w-full">
          <p className="font-semibold truncate text-sm sm:text-base">{entry.name}</p>
          {entry.is_current_user && (
            <Badge variant="outline" className="mt-1 text-[10px]">
              You
            </Badge>
          )}
        </div>
        <p className={cn("text-xl sm:text-2xl font-bold tabular-nums", camperAccentText)}>
          {entry.total_xp}
          <span className={cn("text-xs font-semibold ml-1 opacity-80", camperAccentText)}>XP</span>
        </p>
        <p className={cn("text-[11px] sm:text-xs", camperBody)}>
          {entry.modules_completed} modules · {entry.badges_earned} badges
        </p>
      </div>
    </motion.div>
  )
}

export function CampLeaderboardContent({
  data,
  selectedId,
  onTrainingChange,
}: {
  data: LeaderboardHub
  selectedId: string | undefined
  onTrainingChange: (id: string) => void
}) {
  const [studentName, setStudentName] = useState<string | null>(null)

  useEffect(() => {
    const session = getStudentData()
    setStudentName(session?.name ?? null)
  }, [])

  const topThree = useMemo(() => data.leaderboard.slice(0, 3), [data.leaderboard])
  const topXp = data.leaderboard[0]?.total_xp ?? 0
  const userXp = data.current_user?.total_xp ?? data.total_xp ?? 0
  const progressPercent = topXp > 0 ? (userXp / topXp) * 100 : userXp > 0 ? 100 : 0

  const podiumOrder: Array<{ entry: LeaderboardEntry; place: 1 | 2 | 3 }> = []
  if (topThree[1]) podiumOrder.push({ entry: topThree[1], place: 2 })
  if (topThree[0]) podiumOrder.push({ entry: topThree[0], place: 1 })
  if (topThree[2]) podiumOrder.push({ entry: topThree[2], place: 3 })

  const statTiles = [
    { label: "Your rank", value: data.current_user ? `#${data.current_user.rank}` : "—", icon: Trophy },
    { label: "Modules done", value: data.current_user?.modules_completed ?? 0, icon: Target },
    { label: "Badges earned", value: data.current_user?.badges_earned ?? 0, icon: Award },
    { label: "Campers in track", value: data.leaderboard.length, icon: Users },
  ]

  return (
    <div data-camper-portal className="space-y-8 w-full min-w-0">
      {/* Hero — student stats with grade-style XP circle */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={camperHeroPanel}
      >
        <div className="relative flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--cc-accent-dark)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Your camp performance
          </motion.div>

          <CampXpDonutGauge
            progressPercent={progressPercent}
            value={userXp.toLocaleString()}
            unit="Camp XP"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.65 }}
            className="mt-4 sm:mt-5 space-y-1"
          >
            <p className={cn("text-lg sm:text-xl font-semibold", camperTitle)}>
              {studentName ?? data.current_user?.name ?? "Camper"}
            </p>
            {data.current_user && data.leaderboard.length > 0 && (
              <p className={camperBody}>
                Rank <span className={cn("font-bold", camperAccentText)}>#{data.current_user.rank}</span>
                {" "}of{" "}
                <span className="font-semibold">{data.leaderboard.length}</span>
                {" "}campers
                {topXp > 0 && userXp < topXp && (
                  <span className="block sm:inline sm:ml-1 mt-0.5 sm:mt-0 text-xs text-slate-500">
                    · {Math.round(progressPercent)}% of top camper XP
                  </span>
                )}
              </p>
            )}
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-6 grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
          >
            {statTiles.map((tile) => (
              <motion.div
                key={tile.label}
                variants={fadeUp}
                className={cn(camperCard, "backdrop-blur-sm px-3 py-3 sm:py-4 text-center")}
              >
                <tile.icon className={cn("h-4 w-4 mx-auto mb-1.5", camperPageIcon)} />
                <p className={cn("text-[10px] sm:text-xs uppercase tracking-wide", camperBody)}>{tile.label}</p>
                <p className="text-lg sm:text-xl font-bold tabular-nums mt-0.5">{tile.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {data.trainings.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-sm"
        >
          <label className="text-xs text-slate-500 mb-1.5 block font-medium">Training track</label>
          <Select value={selectedId} onValueChange={onTrainingChange}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select training" />
            </SelectTrigger>
            <SelectContent>
              {data.trainings.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {topThree.length > 0 && (
        <section className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-2"
          >
            <Trophy className={cn("h-5 w-5", camperPageIcon)} />
            <h2 className={camperHeading}>Top campers</h2>
          </motion.div>

          {/* Mobile: stacked · Desktop: podium */}
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end sm:gap-4">
            {podiumOrder.map(({ entry, place }, i) => (
              <PodiumCard key={entry.student_id} entry={entry} place={place} delay={0.4 + i * 0.1} />
            ))}
          </div>
        </section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
          <h2 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-500" />
            Full standings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by total XP from completed modules in this training track.
          </p>
        </div>

        {data.leaderboard.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">No campers enrolled in this track yet.</p>
        ) : (
          <motion.ul
            variants={stagger}
            initial="hidden"
            animate="show"
            className="divide-y divide-slate-200/80 dark:divide-white/10"
          >
            {data.leaderboard.map((entry, index) => (
              <motion.li
                key={entry.student_id}
                variants={fadeUp}
                custom={index}
                className={cn(
                  "flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors",
                  entry.is_current_user && "bg-violet-500/[0.06] dark:bg-violet-500/10",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] text-sm font-bold text-slate-600 dark:text-slate-300">
                  {entry.rank <= 3 ? (
                    <Medal
                      className={cn(
                        "h-4 w-4",
                        entry.rank === 1 && "text-amber-500",
                        entry.rank === 2 && "text-slate-400",
                        entry.rank === 3 && "text-orange-500",
                      )}
                    />
                  ) : (
                    `#${entry.rank}`
                  )}
                </span>

                <Avatar className="size-9 shrink-0 border border-slate-200/80 dark:border-white/10">
                  <AvatarFallback className="bg-gradient-to-br from-violet-600/90 to-indigo-600/90 text-white text-xs font-semibold">
                    {initials(entry.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm sm:text-base">
                    {entry.name}
                    {entry.is_current_user && (
                      <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                        You
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entry.modules_completed} modules · {entry.badges_earned} badges
                  </p>
                </div>

                <span className="text-sm sm:text-base font-bold tabular-nums text-violet-700 dark:text-violet-300 shrink-0">
                  {entry.total_xp.toLocaleString()}
                  <span className="text-[10px] font-semibold ml-0.5 opacity-70">XP</span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </motion.section>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-slate-500 text-center sm:text-left"
      >
        XP is awarded when you complete each module (Lesson 0 = 50 XP, up to 500 XP for the final showcase).
        Complete modules to climb the board.
      </motion.p>
    </div>
  )
}
