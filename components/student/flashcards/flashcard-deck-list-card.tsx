"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, ChevronRight, Clock, Lock, Pencil, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FlashcardDeck } from "@/lib/flashcards"
import type { FlashcardDeckMastery } from "@/lib/flashcard-gamification"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  clampMasteryPct,
  flashcardDeckMetaLine,
  flashcardDeckStatusAccent,
  flashcardDeckStatusLabel,
  flashcardDeckTopicLabel,
  resolveFlashcardDeckKind,
  type FlashcardDeckCardKind,
} from "@/lib/flashcard-deck-kind"
import { flashcardDeckSolidThumb } from "@/lib/flashcard-deck-thumb"
import { FLASHCARD_CARD_SURFACE } from "@/lib/flashcard-list-theme"
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
  mastery?: FlashcardDeckMastery | null
  studyLocked?: boolean
  accessMeta?: string | null
  colorIndex?: number
}

function thumbIcon(kind: FlashcardDeckCardKind, studyLocked?: boolean): LucideIcon {
  if (studyLocked) return Lock
  if (kind === "empty") return Pencil
  if (kind === "completed") return CheckCircle2
  if (kind === "in_progress") return Clock
  return Play
}

/** Mobile-style flashcard deck row — Color Hunt solid thumb + status line. */
export function FlashcardDeckListCard({
  deck,
  studyHref,
  editHref,
  compact,
  mastery,
  studyLocked = false,
  accessMeta = null,
  colorIndex = 0,
}: Props) {
  const { roles: ROLES, thumbs } = useFlashcardChrome()
  const masteryPct = mastery?.pct ?? 0
  const kind = resolveFlashcardDeckKind(deck, masteryPct)
  const progress = clampMasteryPct(masteryPct)
  const thumb = flashcardDeckSolidThumb(
    deck.id,
    kind,
    { locked: studyLocked, index: colorIndex },
    { thumbs, roles: ROLES },
  )
  const statusColor = flashcardDeckStatusAccent(kind, thumb.fill, studyLocked, ROLES)
  const statusLabel = flashcardDeckStatusLabel(kind, studyLocked)
  const metaLine = accessMeta ?? flashcardDeckMetaLine(deck, masteryPct)
  const showProgress = !studyLocked && kind === "in_progress"
  const Icon = thumbIcon(kind, studyLocked)

  const rowHref =
    deck.cardCount <= 0 && deck.canEdit && editHref ? editHref : studyHref
  const rowDisabled = deck.cardCount <= 0 && !deck.canEdit

  const rowBody = (
    <>
      <SolidListThumbTile thumb={thumb} icon={Icon} size={compact ? "compact" : "list"} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cc-text)]">
          {deck.title || "Untitled deck"}
        </p>
        <p className="truncate text-xs text-[var(--cc-text-muted)]">{flashcardDeckTopicLabel(deck)}</p>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {studyLocked ? (
              <Lock className="size-3.5 shrink-0" style={{ color: statusColor }} aria-hidden />
            ) : kind === "completed" ? (
              <CheckCircle2 className="size-3.5 shrink-0" style={{ color: statusColor }} aria-hidden />
            ) : (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor }}
                aria-hidden
              />
            )}
            <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            <span className="text-[11px] text-[var(--cc-text-muted)]">• {metaLine}</span>
          </div>

          {showProgress ? (
            <div
              className="h-1 w-[52px] shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: `${thumb.fill}29` }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(progress, 4)}%`,
                  backgroundColor: thumb.fill,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <MaterialInteractiveSurface
      className={cn(
        materialSurfaceClass,
        FLASHCARD_CARD_SURFACE,
        "flex items-center gap-3 px-3 py-3",
        compact ? "min-h-[76px]" : "min-h-[88px]",
      )}
      style={{ ["--material-ink" as string]: thumb.fill }}
      disabled={rowDisabled}
    >
      {rowDisabled ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 opacity-70">{rowBody}</div>
      ) : (
        <Link href={rowHref} className="flex min-w-0 flex-1 items-center gap-3">
          {rowBody}
        </Link>
      )}

      {deck.canEdit && editHref ? (
        <Link
          href={editHref}
          className="relative z-[1] shrink-0 rounded-lg p-1.5"
          style={{ color: ROLES.edit.fill }}
          aria-label="Edit deck"
        >
          <Pencil className="size-[18px]" />
        </Link>
      ) : (
        !rowDisabled ? (
          <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
        ) : null
      )}
    </MaterialInteractiveSurface>
  )
}
