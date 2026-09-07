"use client"

import { Award, History, Layers, Lightbulb, Trophy } from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { cn } from "@/lib/utils"

const MODULE_ID = "practice"
export const PRACTICE_HUB_BASE = "/student/dashboard-v2/practice"

export type PracticeBrowseId = "topics" | "history" | "leaderboard" | "badges" | "flashcards"

export function resolvePracticeBrowseId(pathname: string | null): PracticeBrowseId {
  const path = (pathname || "").replace(/\/$/, "")
  if (path.endsWith("/history")) return "history"
  if (path.endsWith("/leaderboard")) return "leaderboard"
  if (path.endsWith("/flashcards")) return "flashcards"
  if (path.endsWith("/badges")) return "badges"
  return "topics"
}

export type PracticeBrowseCounts = {
  topics?: number
  sessions?: number
  badges?: number
  flashcards?: number
}

/** Shared Practice Hub Browse rail (Notes / Flashcards / CodeBench / Cora pattern). */
export function PracticeBrowseNav({
  activeId,
  counts,
  className,
}: {
  activeId: PracticeBrowseId
  counts?: PracticeBrowseCounts
  className?: string
}) {
  return (
    <FacultyModuleSideMenu
      embedded
      className={cn(
        "@[720px]/practice-hub:border-r @[720px]/practice-hub:border-[var(--border)] @[720px]/practice-hub:pr-4",
        className,
      )}
      moduleId={MODULE_ID}
      accent={{ soft: "var(--cc-accent-soft)", ink: "var(--cc-text)" }}
      title="Browse"
      activeId={activeId}
      items={[
        {
          id: "topics",
          label: "Topics",
          icon: Lightbulb,
          href: PRACTICE_HUB_BASE,
          badge: counts?.topics && counts.topics > 0 ? counts.topics : undefined,
        },
        {
          id: "history",
          label: "History",
          icon: History,
          href: `${PRACTICE_HUB_BASE}/history`,
          badge: counts?.sessions && counts.sessions > 0 ? counts.sessions : undefined,
        },
        {
          id: "leaderboard",
          label: "Leaderboard",
          icon: Trophy,
          href: `${PRACTICE_HUB_BASE}/leaderboard`,
        },
        {
          id: "badges",
          label: "Badges",
          icon: Award,
          href: `${PRACTICE_HUB_BASE}/badges`,
          badge: counts?.badges && counts.badges > 0 ? counts.badges : undefined,
        },
        {
          id: "flashcards",
          label: "Flashcards",
          icon: Layers,
          href: `${PRACTICE_HUB_BASE}/flashcards`,
          badge: counts?.flashcards && counts.flashcards > 0 ? counts.flashcards : undefined,
        },
      ]}
    />
  )
}
