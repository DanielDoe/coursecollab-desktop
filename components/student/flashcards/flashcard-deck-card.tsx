"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { BookOpen, Brain, CheckCircle2, Clock, Pencil, Play, User, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FlashcardDeck } from "@/lib/flashcards"
import type { FlashcardDeckMastery } from "@/lib/flashcard-gamification"
import { FlashcardDeckListCard } from "@/components/student/flashcards/flashcard-deck-list-card"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  resolveFlashcardDeckKind,
  type FlashcardDeckCardKind,
} from "@/lib/flashcard-deck-kind"
import { flashcardDeckSolidThumb } from "@/lib/flashcard-deck-thumb"
import {
  FLASHCARD_CARD_SURFACE,
  flashcardListMasteryColor,
} from "@/lib/flashcard-list-theme"
import { useFlashcardChrome } from "@/hooks/use-flashcard-chrome"
import {
  MaterialInteractiveSurface,
  materialSurfaceClass,
} from "@/components/ui/material-interactive-surface"

type Props = {
  deck: FlashcardDeck
  studyHref: string
  editHref?: string
  compact?: boolean
  layout?: "grid" | "list"
  mastery?: FlashcardDeckMastery | null
  colorIndex?: number
}

function gridThumbIcon(kind: FlashcardDeckCardKind): LucideIcon {
  if (kind === "empty") return Pencil
  if (kind === "completed") return CheckCircle2
  if (kind === "in_progress") return Clock
  return Play
}

export function FlashcardDeckCard({
  deck,
  studyHref,
  editHref,
  compact,
  layout = "grid",
  mastery,
  colorIndex = 0,
}: Props) {
  const { roles: ROLES, thumbs } = useFlashcardChrome()
  const masteryPct = mastery?.pct ?? 0
  const showMastery = mastery && mastery.total > 0
  const isCourse = deck.deckKind === "course"
  const kindLabel = isCourse ? "Course" : "My deck"
  const KindIcon = isCourse ? BookOpen : User
  const kind = resolveFlashcardDeckKind(deck, masteryPct)
  const thumb = flashcardDeckSolidThumb(deck.id, kind, { index: colorIndex }, { thumbs, roles: ROLES })
  const barColor = flashcardListMasteryColor(masteryPct, thumb.fill, ROLES)
  const studyDisabled = deck.cardCount === 0
  const kindChip = isCourse ? ROLES.course : ROLES.mine

  if (layout === "list") {
    return (
      <FlashcardDeckListCard
        deck={deck}
        studyHref={studyHref}
        editHref={editHref}
        compact={compact}
        mastery={mastery}
        colorIndex={colorIndex}
      />
    )
  }

  return (
    <MaterialInteractiveSurface
      className={cn(
        materialSurfaceClass,
        FLASHCARD_CARD_SURFACE,
        "flex h-full flex-col overflow-hidden",
      )}
      style={{ ["--material-ink" as string]: thumb.fill }}
    >
      <div className="flex items-start gap-3 p-4">
        <SolidListThumbTile thumb={thumb} icon={gridThumbIcon(kind)} size="list" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold text-[var(--cc-text)]">{deck.title || "Untitled deck"}</h3>
          {deck.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">
              {deck.description}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
              {deck.cardCount === 0 ? "Add cards to start studying" : `${deck.cardCount} cards`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: thumb.fill }}>
              <Brain className="h-3 w-3" />
              {deck.cardCount} card{deck.cardCount !== 1 ? "s" : ""}
            </span>
            {deck.topic ? (
              <span
                className="inline-flex max-w-[10rem] truncate rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: ROLES.topic.fill, color: ROLES.topic.icon }}
              >
                {deck.topic}
              </span>
            ) : null}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: kindChip.fill, color: kindChip.icon }}
            >
              <KindIcon className="h-3 w-3" />
              {kindLabel}
            </span>
            {deck.showInPracticeHub ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold"
                style={{ backgroundColor: ROLES.xp.fill, color: ROLES.xp.icon }}
              >
                <Zap className="h-3 w-3" fill="currentColor" />
                XP
              </span>
            ) : null}
          </div>

          {showMastery ? (
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-medium text-[var(--cc-text-muted)]">
                <span>Mastery</span>
                <span className="font-semibold" style={{ color: barColor }}>
                  {masteryPct}% · {mastery.mastered}/{mastery.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: `${barColor}29` }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${masteryPct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center justify-end gap-2 pt-3">
          {editHref && deck.canEdit ? (
            <Button
              asChild
              size="sm"
              className="gap-1.5 border-0 shadow-sm hover:opacity-90"
              style={{ backgroundColor: ROLES.edit.fill, color: ROLES.edit.icon }}
            >
              <Link href={editHref}>
                <Pencil className="h-4 w-4" fill="currentColor" />
                Edit
              </Link>
            </Button>
          ) : null}
          {studyDisabled ? (
            <Button
              size="sm"
              disabled
              className="gap-1.5 border-0 shadow-sm"
              style={{ backgroundColor: ROLES.studyDisabled.fill, color: ROLES.studyDisabled.icon }}
            >
              <Play className="h-4 w-4" fill="currentColor" />
              Study
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="gap-1.5 border-0 shadow-sm hover:opacity-90"
              style={{ backgroundColor: ROLES.study.fill, color: ROLES.study.icon }}
            >
              <Link href={studyHref}>
                <Play className="h-4 w-4" fill="currentColor" />
                Study
              </Link>
            </Button>
          )}
        </div>
      </div>
    </MaterialInteractiveSurface>
  )
}
