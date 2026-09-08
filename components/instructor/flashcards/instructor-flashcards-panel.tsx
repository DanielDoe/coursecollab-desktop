"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { InstructorFlashcardsAllView } from "@/components/instructor/flashcards/instructor-flashcards-all-view"
import { InstructorFlashcardsTopicsView } from "@/components/instructor/flashcards/instructor-flashcards-topics-view"
import { InstructorFlashcardsConfigView } from "@/components/instructor/flashcards/instructor-flashcards-config-view"
import { InstructorFlashcardsDeletedView } from "@/components/instructor/flashcards/instructor-flashcards-deleted-view"
import { InstructorModuleStudentActivityView } from "@/components/instructor/module-activity/InstructorModuleStudentActivityView"
import { Layers, FolderOpen, SlidersHorizontal, Trash2, Loader2, Users } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"

export type FlashcardMenu = "all" | "topics" | "configuration" | "deleted" | "student-activity"

const FLASHCARD_MODULE_ID = "flashcards"

const MENU_ITEMS = [
  { id: "all" as const, label: "All Flashcards", icon: Layers },
  { id: "topics" as const, label: "Topics", icon: FolderOpen },
  { id: "configuration" as const, label: "Card Configuration", icon: SlidersHorizontal },
  { id: "student-activity" as const, label: "Student Activity", icon: Users },
  { id: "deleted" as const, label: "Deleted Items", icon: Trash2 },
]

export function InstructorFlashcardsPanel() {
  const scopeKey = useInstructorScopeKey()
  const [activeMenu, setActiveMenu] = useState<FlashcardMenu>("all")
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [deletedCount, setDeletedCount] = useState(0)
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadDecks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/decks", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load decks")
      setDecks(data.decks || [])
    } catch (err: unknown) {
      toast.error("Could not load flashcard decks", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDeletedCount = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", { headers: headers() })
      const data = await res.json()
      if (res.ok) {
        setDeletedCount((data.decks?.length ?? 0) + (data.cards?.length ?? 0))
      }
    } catch {
      /* optional */
    }
  }, [])

  const reload = useCallback(async () => {
    await loadDecks()
    await loadDeletedCount()
  }, [loadDecks, loadDeletedCount])

  useEffect(() => {
    void loadDecks()
    void loadDeletedCount()
  }, [loadDecks, loadDeletedCount, scopeKey])

  const topicCount = useMemo(() => {
    const names = new Set<string>()
    for (const deck of decks) {
      names.add(deck.topic?.trim() || "General")
    }
    return names.size
  }, [decks])

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId={FLASHCARD_MODULE_ID}
      title="Flashcards"
      activeId={activeMenu}
      onSelect={(id) => setActiveMenu(id as FlashcardMenu)}
      items={MENU_ITEMS.map((item) => ({
        ...item,
        badge:
          item.id === "topics"
            ? topicCount
            : item.id === "deleted" && deletedCount > 0
              ? deletedCount
              : undefined,
        tone: item.id === "deleted" ? ("destructive" as const) : undefined,
      }))}
    />
  )

  if (loading && decks.length === 0 && activeMenu === "all") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--cc-accent)]" />
      </div>
    )
  }

  return (
    <FacultyModuleSplitLayout scrollMode="panel" className="min-h-0 flex-1" menu={sidebar}>
      {activeMenu === "all" ? (
        <InstructorFlashcardsAllView
          decks={decks}
          selectedDeckId={selectedDeckId}
          topicFilter={null}
          onSelectDeck={setSelectedDeckId}
          onClearTopicFilter={() => {}}
          onReload={reload}
        />
      ) : null}

      {activeMenu === "topics" ? (
        <InstructorFlashcardsTopicsView decks={decks} onReload={reload} />
      ) : null}

      {activeMenu === "configuration" ? <InstructorFlashcardsConfigView /> : null}

      {activeMenu === "student-activity" ? (
        <InstructorModuleStudentActivityView
          module="flashcards"
          moduleId={FLASHCARD_MODULE_ID}
          embedInDashboard
        />
      ) : null}

      {activeMenu === "deleted" ? <InstructorFlashcardsDeletedView onRestored={reload} /> : null}
    </FacultyModuleSplitLayout>
  )
}
