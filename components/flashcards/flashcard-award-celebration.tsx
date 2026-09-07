"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import type { FlashcardAward, FlashcardAwardTier } from "@/lib/flashcard-awards"
import { cn } from "@/lib/utils"
import { Crown, Flame, Medal, Sparkles, Star, Trophy, Zap } from "lucide-react"

const TIER_RING: Record<FlashcardAwardTier, string> = {
  bronze: "from-amber-600/80 via-orange-500/60 to-amber-700/80",
  silver: "from-slate-300/90 via-white/70 to-slate-400/80",
  gold: "from-amber-300 via-yellow-200 to-amber-400",
  legendary: "from-violet-500 via-fuchsia-400 to-amber-400",
}

const TIER_GLOW: Record<FlashcardAwardTier, string> = {
  bronze: "shadow-amber-500/30",
  silver: "shadow-slate-400/30",
  gold: "shadow-amber-400/40",
  legendary: "shadow-violet-500/45",
}

function AwardIcon({ award }: { award: FlashcardAward }) {
  const className = "h-10 w-10 text-white drop-shadow"
  switch (award.icon) {
    case "flame":
      return <Flame className={className} />
    case "crown":
      return <Crown className={className} />
    case "zap":
      return <Zap className={className} />
    case "medal":
      return <Medal className={className} />
    case "sparkles":
      return <Sparkles className={className} />
    case "star":
      return <Star className={className} />
    default:
      return <Trophy className={className} />
  }
}

function burstForTier(tier: FlashcardAwardTier, reducedMotion: boolean) {
  if (reducedMotion) return
  const colors =
    tier === "legendary"
      ? ["#8b5cf6", "#f59e0b", "#10b981", "#ec4899"]
      : tier === "gold"
        ? ["#fbbf24", "#f59e0b", "#fcd34d"]
        : ["#f59e0b", "#8b5cf6"]
  confetti({
    particleCount: tier === "legendary" ? 80 : tier === "gold" ? 50 : 28,
    spread: 72,
    origin: { y: 0.55 },
    colors,
  })
}

type Props = {
  award: FlashcardAward | null
  onDismiss: () => void
  focus?: boolean
}

export function FlashcardAwardCelebration({ award, onDismiss, focus = false }: Props) {
  const [mounted, setMounted] = useState(false)
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!award) return
    burstForTier(award.tier, reducedMotion)
    const timer = window.setTimeout(onDismiss, reducedMotion ? 1200 : 2600)
    return () => window.clearTimeout(timer)
  }, [award, onDismiss, reducedMotion])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {award ? (
        <motion.div
          key={award.id}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />
          <motion.div
            role="dialog"
            aria-live="polite"
            aria-label={award.title}
            initial={{ opacity: 0, scale: 0.82, y: 24, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -12 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className={cn(
              "relative w-full max-w-sm overflow-hidden rounded-3xl border p-6 text-center shadow-2xl",
              focus
                ? "border-white/15 bg-slate-950/95 text-white"
                : "border-[var(--border)] bg-[var(--card)]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "pointer-events-none absolute -inset-16 opacity-40 blur-3xl",
                `bg-gradient-to-br ${TIER_RING[award.tier]}`,
              )}
              aria-hidden
            />
            <motion.div
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.05 }}
              className={cn(
                "relative mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br shadow-lg",
                TIER_RING[award.tier],
                TIER_GLOW[award.tier],
              )}
            >
              <AwardIcon award={award} />
            </motion.div>
            <p className="relative mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">
              Award unlocked
            </p>
            <h3
              className={cn(
                "relative mt-1 text-2xl font-bold tracking-tight",
                focus ? "text-white" : "text-[var(--cc-text)]",
              )}
            >
              {award.title}
            </h3>
            <p
              className={cn(
                "relative mt-2 text-sm",
                focus ? "text-white/65" : "text-[var(--cc-text-muted)]",
              )}
            >
              {award.subtitle}
            </p>
            {award.xp != null && award.xp > 0 ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative mt-3 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-200"
              >
                +{award.xp} XP
              </motion.p>
            ) : null}
            <Button
              type="button"
              className={cn(
                "relative mt-5 w-full",
                focus ? "bg-white/10 text-white hover:bg-white/15" : "bg-amber-600 hover:bg-amber-700",
              )}
              onClick={onDismiss}
            >
              Continue
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/** Queue awards one at a time during a study session. */
export function useFlashcardAwardQueue() {
  const [active, setActive] = useState<FlashcardAward | null>(null)
  const queueRef = useRef<FlashcardAward[]>([])
  const shownRef = useRef<Set<string>>(new Set())

  const dismiss = useCallback(() => {
    setActive(null)
    window.setTimeout(() => {
      const next = queueRef.current.shift()
      if (next) setActive(next)
    }, 180)
  }, [])

  const pushAward = useCallback((award: FlashcardAward, options?: { oncePerSession?: boolean }) => {
    const key = options?.oncePerSession ? award.id : `${award.id}-${Date.now()}`
    if (options?.oncePerSession && shownRef.current.has(award.id)) return
    if (options?.oncePerSession) shownRef.current.add(award.id)

    if (!active) {
      setActive(award)
    } else {
      queueRef.current.push(award)
    }
  }, [active])

  const resetAwards = useCallback(() => {
    queueRef.current = []
    shownRef.current.clear()
    setActive(null)
  }, [])

  return { activeAward: active, pushAward, dismissAward: dismiss, resetAwards }
}
