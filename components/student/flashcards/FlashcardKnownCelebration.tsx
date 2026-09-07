"use client"

import { useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type FlashcardCelebrationPayload = {
  pointsEarned: number
  streakBonus: number
  streak: number
  bonusType?: "timed" | "boss"
  firstKnownThisWeek?: boolean
}

type Props = {
  payload: FlashcardCelebrationPayload
  onComplete: () => void
  focus?: boolean
  accent?: string
}

const PARTICLE_COUNT = 16
const DURATION_MS = 1300

const PARTICLE_ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
  angle: (index / PARTICLE_COUNT) * Math.PI * 2,
  distance: 72 + (index % 4) * 18,
}))

export function FlashcardKnownCelebration({
  payload,
  onComplete,
  focus = false,
  accent = "var(--cc-accent)",
}: Props) {
  const particleColors = useMemo(
    () =>
      focus
        ? ["#f59e0b", "#8b5cf6", "#10b981", "#3b82f6", "#ec4899", "#06b6d4"]
        : ["#f59e0b", "#8b5cf6", "#10b981", "#3b82f6", "#ec4899", "#06b6d4"],
    [focus],
  )

  const bonusLines = useMemo(() => {
    const lines: string[] = []
    if (payload.bonusType === "timed") lines.push("Speed bonus")
    if (payload.bonusType === "boss") lines.push("Boss card mastered")
    if (payload.streakBonus > 0) lines.push(`+${payload.streakBonus} streak bonus`)
    if (payload.firstKnownThisWeek) lines.push("First mastered this week")
    if (payload.streak >= 3) lines.push(`${payload.streak} card streak`)
    return lines.slice(0, 2)
  }, [payload])

  useEffect(() => {
    const timer = window.setTimeout(onComplete, DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [onComplete, payload.pointsEarned])

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[28px]"
      aria-live="polite"
    >
      <motion.div
        className="absolute size-[280px] rounded-full"
        style={{ backgroundColor: focus ? "rgba(245,158,11,0.35)" : "rgba(245,158,11,0.22)" }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.55, 0], scale: [0.5, 1.1, 1.35] }}
        transition={{ duration: 0.88, ease: "easeOut" }}
      />
      <motion.div
        className="absolute size-[220px] rounded-full border-[3px]"
        style={{ borderColor: focus ? "rgba(255,255,255,0.45)" : "color-mix(in srgb, var(--cc-accent) 55%, transparent)" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.85, 0], scale: [0.4, 1.15, 1.45] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {PARTICLE_ANGLES.map(({ angle, distance }, index) => (
        <motion.span
          key={index}
          className="absolute size-2.5 rounded-full"
          style={{ backgroundColor: particleColors[index % particleColors.length] }}
          initial={{ opacity: 0.95, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance - 24,
            scale: 0.45,
          }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      <motion.div
        className="relative overflow-hidden rounded-full shadow-lg"
        initial={{ opacity: 0, scale: 0.5, y: 28 }}
        animate={{ opacity: 1, scale: [0.5, 1.12, 1], y: -8 }}
        transition={{ delay: 0.08, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="flex items-center gap-1.5 px-5 py-3.5 text-white"
          style={{ backgroundColor: focus ? "rgba(255,255,255,0.18)" : accent }}
        >
          <Sparkles className="size-5 shrink-0" fill="currentColor" strokeWidth={1.75} />
          {payload.pointsEarned > 0 ? (
            <>
              <span className="text-[2rem] font-extrabold leading-none tracking-tight">
                +{payload.pointsEarned}
              </span>
              <span className="mt-1 text-base font-bold text-white/90">XP</span>
            </>
          ) : (
            <span className="text-2xl font-extrabold tracking-tight">Mastered!</span>
          )}
        </div>
      </motion.div>

      {bonusLines.length > 0 ? (
        <motion.div
          className="absolute bottom-[18%] flex max-w-full flex-wrap justify-center gap-2 px-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.32 }}
        >
          {bonusLines.map((line) => (
            <span
              key={line}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold",
                focus
                  ? "border-amber-300/35 bg-amber-400/20 text-amber-100"
                  : "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200",
              )}
            >
              {line}
            </span>
          ))}
        </motion.div>
      ) : null}
    </div>
  )
}
