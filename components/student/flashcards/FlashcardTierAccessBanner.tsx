"use client"

import Link from "next/link"
import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FlashcardTierAccessClient } from "@/lib/flashcard-study-policy"

type Props = {
  tierAccess: FlashcardTierAccessClient
  className?: string
  compact?: boolean
}

export function FlashcardTierAccessBanner({ tierAccess, className, compact }: Props) {
  const pct = Math.round(tierAccess.unlockFraction * 100)
  const showUpgrade = tierAccess.upgradeRequiredTier != null
  const blocked = !tierAccess.canStudyCourseDeck

  if (!blocked && tierAccess.unlockFraction >= 1) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/25 px-3 py-2.5 sm:px-4",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]">
            {blocked ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-[var(--cc-text)]">
              {blocked
                ? "Course flashcards require a membership upgrade"
                : `${pct}% of each course deck is unlocked on your plan`}
            </p>
            <p className="text-[var(--cc-text-muted)] leading-snug">
              {blocked
                ? "Personal decks are always free to study. Upgrade to access instructor course decks."
                : tierAccess.dailyCardCap >= 0
                  ? `Up to ${tierAccess.dailyCardCap} course cards per day · locked cards need a higher tier`
                  : "Remaining cards in each deck need a higher membership tier."}
            </p>
          </div>
        </div>
        {showUpgrade ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-[var(--cc-accent)]/30 text-[var(--cc-accent)] hover:bg-[var(--cc-accent)]/10"
          >
            <Link href="/student/membership">Upgrade to {tierAccess.upgradeRequiredTier}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
