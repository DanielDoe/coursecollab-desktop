"use client"

import { ChevronRight, FolderOpen, Layers, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

export type FlashcardTopicCardData = {
  name: string
  deck_count: number
  card_count: number
}

type Props = {
  topic: FlashcardTopicCardData
  viewMode: "grid" | "list"
  onOpen: () => void
}

const MODULE_ID = "flashcards"

export function FlashcardTopicCard({ topic, viewMode, onOpen }: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const deckLabel = `${topic.deck_count} deck${topic.deck_count === 1 ? "" : "s"}`
  const cardLabel = `${topic.card_count} card${topic.card_count === 1 ? "" : "s"}`

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          PORTAL_CARD,
          "group relative overflow-hidden transition-all",
          "hover:border-[var(--cc-accent)]/30 hover:shadow-md hover:shadow-[var(--cc-accent)]/5",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left"
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              chrome.p.softBg,
            )}
          >
            <FolderOpen className={cn("h-4 w-4", chrome.p.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--cc-text)] truncate">{topic.name}</p>
            <p className="text-xs text-[var(--cc-text-muted)] mt-0.5">
              {deckLabel} · {cardLabel}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </button>
      </article>
    )
  }

  return (
    <article
      className={cn(
        PORTAL_CARD,
        "group relative overflow-hidden transition-all",
        "hover:border-[var(--cc-accent)]/35 hover:shadow-lg hover:shadow-[var(--cc-accent)]/8 hover:-translate-y-0.5",
      )}
    >
      <button type="button" onClick={onOpen} className="relative flex h-full w-full flex-col p-4 sm:p-5 text-left">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
              chrome.p.softBg,
            )}
          >
            <FolderOpen className={cn("h-5 w-5", chrome.p.iconText)} />
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-40 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 mt-1" />
        </div>

        <h3 className="mt-4 text-base font-semibold leading-snug text-[var(--cc-text)] line-clamp-2 pr-1">
          {topic.name}
        </h3>

        <div className="mt-auto pt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sidebar-accent)]/60 px-2.5 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)]">
            <Layers className="h-3 w-3 opacity-70" />
            {deckLabel}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              chrome.p.softBg,
              chrome.p.iconText,
            )}
          >
            <Sparkles className="h-3 w-3 opacity-80" />
            {cardLabel}
          </span>
        </div>
      </button>
    </article>
  )
}

