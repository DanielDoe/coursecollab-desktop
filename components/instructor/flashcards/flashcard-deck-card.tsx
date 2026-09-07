"use client"

import {
  ArrowRight,
  Calendar,
  Clock,
  Layers,
  Star,
  Activity,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

const deckChrome = facultyEmbedChrome("flashcards")

export const FLASHCARD_DECK_PAGE_SIZE = 6

type DeckCardProps = {
  title: string
  description?: string
  topic?: string
  cardCount: number
  isPublished: boolean
  showInPracticeHub?: boolean
  updatedAt?: string
  selected: boolean
  onSelect: () => void
}

function formatRelativeUpdated(iso?: string): string {
  if (!iso) return "Recently"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Recently"
  const diffMs = Date.now() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function estimateStudyMinutes(cardCount: number): number {
  if (cardCount <= 0) return 0
  return Math.max(3, Math.round(cardCount * 1.5))
}

function deckReadinessPercent(cardCount: number, isPublished: boolean): number {
  if (cardCount === 0) return 0
  if (!isPublished) return Math.min(85, 35 + cardCount * 5)
  return Math.min(100, 55 + cardCount * 5)
}

function TopicDeckIcon({ topic, title }: { topic?: string; title: string }) {
  const haystack = `${topic ?? ""} ${title}`.toLowerCase()
  const Icon = /op.?amp|first.?order|rc|rl|transient/i.test(haystack)
    ? Zap
    : /ac|phasor|impedance/i.test(haystack)
      ? Activity
      : Layers

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm",
        deckChrome.p.softBg,
      )}
    >
      <Icon className={cn("h-5 w-5", deckChrome.p.iconText)} strokeWidth={2.2} />
    </div>
  )
}

function DeckProgressRing({ percent, label }: { percent: number; label: string }) {
  const r = 14
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="relative h-9 w-9 shrink-0">
        <svg className="-rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-[var(--muted)]" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={deckChrome.p.iconText}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-xs font-semibold tabular-nums text-[var(--cc-text)]">{percent}%</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function FlashcardDeckCard({
  title,
  topic,
  cardCount,
  isPublished,
  showInPracticeHub = false,
  updatedAt,
  selected,
  onSelect,
}: DeckCardProps) {
  const cardLabel = `${cardCount} card${cardCount === 1 ? "" : "s"}`
  const topicLabel = topic?.trim() || "General"
  const estMinutes = estimateStudyMinutes(cardCount)
  const readiness = deckReadinessPercent(cardCount, isPublished)
  const readinessLabel = cardCount === 0 ? "Empty" : isPublished ? "Mastered" : "Draft"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-[var(--card)] text-left transition-colors",
        selected
          ? cn(deckChrome.p.softBg, deckChrome.p.border, "ring-1 ring-current/10")
          : "border-[var(--border)] hover:bg-[var(--cc-accent-soft)]/45",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex gap-3 p-3 pb-2.5">
          <TopicDeckIcon topic={topic} title={title} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--cc-text)]">
                {title}
              </h3>
              {showInPracticeHub && isPublished ? (
                <Star className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 fill-current", deckChrome.p.iconText)} />
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {topicLabel} · {cardLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isPublished ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Draft
                </span>
              )}
              {showInPracticeHub && isPublished ? (
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", deckChrome.p.softBg, deckChrome.p.iconText)}>
                  Hub
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mx-3 border-t border-[var(--border)]/70" />

        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <StatInline icon={Layers} value={String(cardCount)} label="Cards" />
            <StatInline icon={Clock} value={`${estMinutes} min`} label="Est. time" />
            <StatInline icon={Calendar} value="Updated" label={formatRelativeUpdated(updatedAt)} />
          </div>

          <div className="hidden h-8 w-px shrink-0 bg-[var(--border)]/70 sm:block" />

          <DeckProgressRing percent={readiness} label={readinessLabel} />

          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              selected
                ? cn(deckChrome.cta, "text-white")
                : cn(deckChrome.p.softBg, deckChrome.p.iconText),
            )}
          >
            Open deck
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </article>
  )
}

function StatInline({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Layers
  value: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", deckChrome.p.softBg, deckChrome.p.iconText)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold tabular-nums text-[var(--cc-text)]">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export type FlashcardDeckListItem = {
  id: number
  title: string
  description?: string
  topic?: string
  cardCount: number
  isPublished: boolean
  showInPracticeHub?: boolean
  updatedAt?: string
}

type DeckListProps = {
  decks: FlashcardDeckListItem[]
  selectedDeckId: number | null
  onSelectDeck: (id: number) => void
  className?: string
}

export function FlashcardDeckList({ decks, selectedDeckId, onSelectDeck, className }: DeckListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {decks.map((deck) => (
        <FlashcardDeckCard
          key={deck.id}
          title={deck.title}
          description={deck.description}
          topic={deck.topic}
          cardCount={deck.cardCount}
          isPublished={deck.isPublished}
          showInPracticeHub={deck.showInPracticeHub}
          updatedAt={deck.updatedAt}
          selected={selectedDeckId === deck.id}
          onSelect={() => onSelectDeck(deck.id)}
        />
      ))}
    </div>
  )
}

/** @deprecated Use FlashcardDeckCard */
export function FlashcardTopicDeckRow(props: DeckCardProps & { onSelect: () => void }) {
  return <FlashcardDeckCard {...props} />
}

/** @deprecated groups API removed — pass flat `decks` to FlashcardDeckList */
export type FlashcardDeckListGroup = [string, FlashcardDeckListItem[]]
