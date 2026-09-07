"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"

const FlashcardsHome = dynamic(
  () =>
    import("@/components/student/flashcards/flashcards-home").then((m) => ({
      default: m.FlashcardsHome,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[320px]" /> },
)

/** Practice Hub browse → flashcards (course decks flagged for Practice). */
export default function PracticeHubFlashcardsPage() {
  const { roles } = usePracticeChrome()

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--cc-text)]">
            <Layers className="h-4 w-4 shrink-0" style={{ color: roles.browse.ink }} />
            Flashcard decks
          </h3>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            Course decks your instructor flagged for Practice Hub
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 rounded-xl border-0 shadow-sm hover:opacity-90"
          style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
        >
          <Link href="/student/dashboard-v2/flashcards">All flashcards</Link>
        </Button>
      </div>
      <FlashcardsHome practiceHubOnly embedded />
    </div>
  )
}
