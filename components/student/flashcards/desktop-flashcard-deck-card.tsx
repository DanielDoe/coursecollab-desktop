"use client"

import Link from "next/link"
import {
  Binary,
  BookOpen,
  Braces,
  FileCode,
  GitBranch,
  LineChart,
  Pencil,
  Play,
  Repeat,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { cn } from "@/lib/utils"
import type { FlashcardDeck } from "@/lib/flashcards"
import type { FlashcardDeckMastery } from "@/lib/flashcard-gamification"
import { useFlashcardChrome } from "@/hooks/use-flashcard-chrome"

function parseDeckTitle(title: string) {
  const match = title.match(/^(?:Flashcards for )?(Lecture\s+\d+):\s*(.+)$/i)
  if (!match) return { kicker: null as string | null, headline: title || "Untitled deck" }
  return { kicker: match[1], headline: match[2] }
}

function deckMarkIcon(title: string, topic: string | null): LucideIcon {
  const hay = `${title} ${topic ?? ""}`.toLowerCase()
  if (/matlab|plot|visual|simulation|data analysis/.test(hay)) return LineChart
  if (/pointer|memory|array|subscript|new,\s*delete/.test(hay)) return Binary
  if (/function|recursion|parameter|overload/.test(hay)) return Braces
  if (/loop|iteration|control flow/.test(hay)) return Repeat
  if (/condition|branch|if\/else|switch/.test(hay)) return GitBranch
  if (/file|i\/o|records|structures/.test(hay)) return FileCode
  if (/team|project|planning|design/.test(hay)) return Users
  if (/first program|introduction|concept/.test(hay)) return Sparkles
  return BookOpen
}

function DesktopDeckCover({
  title,
  topic,
  accent,
}: {
  title: string
  topic: string | null
  accent: string
}) {
  const parsed = parseDeckTitle(title)
  const lectureNo = (parsed.kicker ?? topic ?? "").match(/(\d+)/)?.[1] ?? null
  const Icon = deckMarkIcon(title, topic)
  return (
    <div
      className="relative flex h-11 items-center justify-between overflow-hidden border-b border-[#e5e7eb] bg-[#f9fafb] px-3 dark:border-[#262626] dark:bg-[#1a1a1a]"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <span className="relative text-[18px] font-semibold tabular-nums leading-none tracking-tight text-[#111827] dark:text-[#f3f4f6]">
        {lectureNo ?? <Icon className="size-5" strokeWidth={2} />}
      </span>
      <Icon className="relative size-4 text-[#6b7280] dark:text-[#9ca3af]" strokeWidth={2.2} />
    </div>
  )
}

function DesktopDeckMark({
  title,
  topic,
  accent,
}: {
  title: string
  topic: string | null
  accent: string
}) {
  const parsed = parseDeckTitle(title)
  const lectureNo = (parsed.kicker ?? topic ?? "").match(/(\d+)/)?.[1] ?? null
  const Icon = deckMarkIcon(title, topic)
  return (
    <span
      className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] text-[#111827] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#f3f4f6]"
      style={{ boxShadow: `inset 2px 0 0 0 ${accent}` }}
    >
      {lectureNo ? (
        <span className="text-[13px] font-semibold tabular-nums leading-none tracking-tight">{lectureNo}</span>
      ) : (
        <Icon className="size-4" strokeWidth={2} />
      )}
      {lectureNo ? (
        <Icon className="absolute bottom-0.5 right-0.5 size-2.5 text-[#6b7280] dark:text-[#9ca3af]" strokeWidth={2.4} />
      ) : null}
    </span>
  )
}

function StudyAction({
  studyTo,
  studyDisabled,
  editHref,
  canEdit,
  compact,
  studyFill,
  studyIcon,
}: {
  studyTo: string
  studyDisabled: boolean
  editHref?: string
  canEdit?: boolean
  compact?: boolean
  studyFill: string
  studyIcon: string
}) {
  const btn = compact ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[12px]"
  return (
    <div className="flex shrink-0 items-center gap-1">
      {editHref && canEdit ? (
        <Link
          href={editHref}
          className={cn(
            "inline-flex items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]",
            compact ? "size-7" : "h-8 gap-1 px-2.5 text-[12px] font-medium",
          )}
          aria-label={compact ? "Edit deck" : undefined}
        >
          <Pencil className="size-3.5" />
          {compact ? null : "Edit"}
        </Link>
      ) : null}
      {studyDisabled && !editHref ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-[6px] bg-[#f3f4f6] font-medium text-[#9ca3af] dark:bg-[#1a1a1a]",
            btn,
          )}
        >
          <Play className="size-3.5" />
          Study
        </span>
      ) : (
        <Link
          href={studyTo}
          className={cn(
            "inline-flex items-center gap-1 rounded-[6px] font-medium",
            btn,
            studyDisabled ? "bg-[#f3f4f6] text-[#6b7280] dark:bg-[#1a1a1a]" : "text-white",
          )}
          style={studyDisabled ? undefined : { backgroundColor: studyFill, color: studyIcon }}
        >
          <Play className="size-3.5" />
          {studyDisabled ? "Add cards" : "Study"}
        </Link>
      )}
    </div>
  )
}

export function DesktopFlashcardDeckCard({
  deck,
  index,
  mastery,
  studyHref,
  editHref,
  layout = "grid",
}: {
  deck: FlashcardDeck
  index: number
  mastery?: FlashcardDeckMastery | null
  studyHref: string
  editHref?: string
  layout?: "grid" | "list"
}) {
  const { roles: ROLES } = useFlashcardChrome()
  const masteryPct = mastery?.pct ?? 0
  const parsed = parseDeckTitle(deck.title)
  const kicker = parsed.kicker ?? (deck.deckKind === "course" ? "Course" : "Mine")
  const studyDisabled = deck.cardCount === 0
  const studyTo = studyDisabled && editHref ? editHref : studyHref
  const themeAccent = ROLES.mastery
  const chipClass =
    "rounded-[4px] bg-[var(--cc-accent-soft)] px-1.5 py-px text-[10px] font-medium text-[var(--cc-accent)]"
  const xpChipClass =
    "inline-flex items-center gap-0.5 rounded-[4px] bg-[#fef3c7] px-1.5 py-px text-[10px] font-medium text-[#92400e] dark:bg-[#422006] dark:text-[#fcd34d]"
  const studyAction = (
    <StudyAction
      studyTo={studyTo}
      studyDisabled={studyDisabled}
      editHref={editHref}
      canEdit={deck.canEdit}
      compact={layout === "list"}
      studyFill={ROLES.study.fill}
      studyIcon={ROLES.study.icon}
    />
  )

  if (layout === "list") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          whileHover={{ x: 2 }}
          transition={{ duration: 0.16 }}
          className="flex min-w-0 items-center gap-3 rounded-[8px] px-3 py-2.5 hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"
        >
          <DesktopDeckMark title={deck.title} topic={deck.topic} accent={themeAccent} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-[#111827] dark:text-[#f3f4f6]">
              {parsed.headline}
            </h3>
            <p className="mt-1 truncate text-[12px] leading-4 text-[#6b7280]">
              {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
              {deck.topic ? ` · ${deck.topic}` : ""}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className={chipClass}>{kicker}</span>
            {deck.showInPracticeHub ? (
              <span className={xpChipClass}>
                <Zap className="size-2.5" fill="currentColor" />
                XP
              </span>
            ) : null}
          </div>
          {mastery && mastery.total > 0 ? (
            <div className="hidden w-16 shrink-0 items-center gap-1.5 md:flex">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#e5e7eb] dark:bg-[#262626]">
                <div
                  className="h-full rounded-full bg-[var(--cc-accent)]"
                  style={{ width: `${masteryPct}%` }}
                />
              </div>
              <span className="w-7 text-right text-[10px] tabular-nums text-[#9ca3af]">{masteryPct}%</span>
            </div>
          ) : null}
          {studyAction}
        </motion.div>
      </motion.article>
    )
  }

  return (
    <article
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--cc-accent)_28%,var(--border))] hover:shadow-[0_4px_12px_rgba(15,23,42,0.04)] dark:border-[#262626] dark:bg-[#171717] dark:hover:border-[color-mix(in_srgb,var(--cc-accent)_32%,#262626)]"
      style={{
        animation: `desktop-deck-card-in 220ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(index, 10) * 30}ms both`,
      }}
    >
      <DesktopDeckCover title={deck.title} topic={deck.topic} accent={themeAccent} />
      <div className="flex min-h-0 flex-1 flex-col px-3.5 py-3.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#111827] dark:text-[#f3f4f6]">
          {parsed.headline}
        </h3>
        <p className="mt-1.5 truncate text-[12px] leading-4 text-[#6b7280]">
          {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
          {deck.topic ? ` · ${deck.topic}` : ""}
        </p>
        {mastery && mastery.total > 0 ? (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#e5e7eb] dark:bg-[#262626]">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-[#9ca3af]">{masteryPct}%</span>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className={chipClass}>{kicker}</span>
            {deck.showInPracticeHub ? (
              <span className={xpChipClass}>
                <Zap className="size-2.5" fill="currentColor" />
                XP
              </span>
            ) : null}
          </div>
          {studyAction}
        </div>
      </div>
    </article>
  )
}
