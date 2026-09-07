"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const DONUT_RADIUS = 75
const DONUT_STROKE = 12
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

type Props = {
  /** 0–100 fill for the progress ring */
  progressPercent: number
  /** Center label, e.g. "2550" */
  value: string | number
  /** Sub-label under the value, e.g. "XP" */
  unit?: string
  size?: "md" | "lg"
  className?: string
}

export function CampXpDonutGauge({
  progressPercent,
  value,
  unit = "XP",
  size = "lg",
  className,
}: Props) {
  const clamped = Math.min(100, Math.max(0, progressPercent))
  const progressLength = (clamped / 100) * DONUT_CIRCUMFERENCE
  const ringColor =
    clamped >= 75
      ? "stroke-violet-500 dark:stroke-violet-400"
      : clamped >= 40
        ? "stroke-amber-500 dark:stroke-amber-400"
        : "stroke-slate-400 dark:stroke-slate-500"

  const sizeClass =
    size === "lg"
      ? "h-44 w-44 sm:h-52 sm:w-52 md:h-56 md:w-56"
      : "h-32 w-32 sm:h-36 sm:w-36"

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", sizeClass, className)}>
      <div className="pointer-events-none absolute -inset-6 -z-10 sm:-inset-8" aria-hidden>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="absolute left-0 top-1/4 h-16 w-16 rounded-full bg-violet-400/18 blur-2xl dark:bg-violet-500/15"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute right-[2%] top-[10%] h-11 w-11 rounded-full bg-amber-300/14 blur-xl dark:bg-amber-400/12"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="absolute bottom-[8%] right-[8%] h-14 w-14 rounded-full bg-violet-400/12 blur-2xl"
        />
      </div>

      <svg
        className="h-full w-full drop-shadow-[0_8px_24px_rgba(88,44,131,0.12)] dark:drop-shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="100" cy="100" r="62" className="fill-violet-50 dark:fill-violet-950/35" />
        <g transform="rotate(-90 100 100)">
          <circle
            cx="100"
            cy="100"
            r={DONUT_RADIUS}
            fill="none"
            strokeWidth={DONUT_STROKE}
            className="stroke-slate-100 dark:stroke-slate-700"
            strokeLinecap="round"
          />
          <motion.circle
            cx="100"
            cy="100"
            r={DONUT_RADIUS}
            fill="none"
            strokeWidth={DONUT_STROKE}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${DONUT_CIRCUMFERENCE}` }}
            animate={{ strokeDasharray: `${progressLength} ${DONUT_CIRCUMFERENCE}` }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className={ringColor}
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3">
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums leading-none tracking-tight text-slate-900 dark:text-white"
        >
          {value}
        </motion.span>
        {unit && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300"
          >
            {unit}
          </motion.span>
        )}
      </div>
    </div>
  )
}
