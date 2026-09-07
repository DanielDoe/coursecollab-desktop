"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import { InstructorFlashcardDeckEditor } from "@/components/instructor/flashcards/instructor-flashcard-deck-editor"
import { useInstructorFlashcardSessions } from "@/components/instructor/flashcards/use-instructor-flashcard-sessions"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  displayContentTitle,
  FacultySidebarPagination,
  formatContentCount,
  orderContentByTopic,
  pageForContentIndex,
} from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { FlashcardDeckList, FlashcardDeckCard, FLASHCARD_DECK_PAGE_SIZE, type FlashcardDeckListItem } from "@/components/instructor/flashcards/flashcard-deck-card"
import { InstructorFlashcardGenerateDialog } from "@/components/instructor/flashcards/instructor-flashcard-generate-dialog"
import { ChevronLeft, Layers, Plus, Sparkles, X } from "lucide-react"
import { toast } from "@/lib/app-toast"

const MODULE_ID = "flashcards"

type Props = {
  decks: FlashcardDeck[]
  selectedDeckId: number | null
  topicFilter: string | null
  onSelectDeck: (id: number | null) => void
  onClearTopicFilter: () => void
  onReload: () => Promise<void>
}

export function InstructorFlashcardsAllView({
  decks,
  selectedDeckId,
  topicFilter,
  onSelectDeck,
  onClearTopicFilter,
  onReload,
}: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const { sessions } = useInstructorFlashcardSessions()
  const [search, setSearch] = useState("")
  const [topicSelect, setTopicSelect] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [topicNames, setTopicNames] = useState<string[]>([])
  const [listPage, setListPage] = useState(1)
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [generateOpen, setGenerateOpen] = useState(false)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  useEffect(() => {
    void (async () => {
      try {
        const res = await instructorApiFetch("/api/instructor/flashcards/topics?session=ALL", { headers: headers() })
        const data = await res.json()
        if (res.ok) {
          setTopicNames((data.topics || []).map((t: { name: string }) => t.name))
        }
      } catch {
        /* optional */
      }
    })()
  }, [])

  const filteredDecks = useMemo(() => {
    const term = search.trim().toLowerCase()
    return decks.filter((deck) => {
      const deckTopic = deck.topic?.trim() || "General"
      if (topicFilter && deckTopic !== topicFilter) return false
      if (topicSelect !== "all" && deckTopic !== topicSelect) return false
      if (statusFilter === "published" && !deck.isPublished) return false
      if (statusFilter === "draft" && deck.isPublished) return false
      if (!term) return true
      return (
        deck.title.toLowerCase().includes(term) ||
        deckTopic.toLowerCase().includes(term) ||
        (deck.description ?? "").toLowerCase().includes(term)
      )
    })
  }, [decks, search, topicFilter, topicSelect, statusFilter])

  const orderedDecks = useMemo(() => orderContentByTopic(filteredDecks), [filteredDecks])

  const totalListPages = Math.max(1, Math.ceil(orderedDecks.length / FLASHCARD_DECK_PAGE_SIZE))
  const pageDecks = useMemo(() => {
    const start = (listPage - 1) * FLASHCARD_DECK_PAGE_SIZE
    return orderedDecks.slice(start, start + FLASHCARD_DECK_PAGE_SIZE)
  }, [orderedDecks, listPage])

  const pageDeckItems = useMemo(
    (): FlashcardDeckListItem[] =>
      pageDecks.map((deck) => ({
        id: deck.id,
        title: displayContentTitle(deck.title),
        description: deck.description,
        topic: deck.topic?.trim() || "General",
        cardCount: deck.cardCount,
        isPublished: deck.isPublished,
        showInPracticeHub: deck.showInPracticeHub,
        updatedAt: deck.updatedAt,
      })),
    [pageDecks],
  )

  const selectedIndex = useMemo(
    () => (selectedDeckId ? orderedDecks.findIndex((deck) => deck.id === selectedDeckId) : -1),
    [orderedDecks, selectedDeckId],
  )

  useEffect(() => {
    setListPage(1)
  }, [search, topicSelect, statusFilter, topicFilter, viewMode])

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages)
  }, [listPage, totalListPages])

  useEffect(() => {
    if (selectedIndex >= 0) setListPage(pageForContentIndex(selectedIndex, FLASHCARD_DECK_PAGE_SIZE))
  }, [selectedIndex])

  const goToPreviousDeck = useCallback(() => {
    if (selectedIndex > 0) onSelectDeck(orderedDecks[selectedIndex - 1]!.id)
  }, [orderedDecks, onSelectDeck, selectedIndex])

  const goToNextDeck = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < orderedDecks.length - 1) {
      onSelectDeck(orderedDecks[selectedIndex + 1]!.id)
    }
  }, [orderedDecks, onSelectDeck, selectedIndex])

  const createDeck = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/decks", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: "New flashcard deck",
          topic:
            topicFilter && topicFilter !== "General"
              ? topicFilter
              : topicSelect !== "all" && topicSelect !== "General"
                ? topicSelect
                : null,
          showInPracticeHub: false,
          isPublished: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      await onReload()
      onSelectDeck(data.deck.id)
    } catch (err: unknown) {
      toast.error("Create failed", { description: err instanceof Error ? err.message : undefined })
    }
  }, [onReload, onSelectDeck, topicFilter, topicSelect])

  const topicOptions = useMemo(() => {
    const names = new Set<string>()
    for (const deck of decks) names.add(deck.topic?.trim() || "General")
    return [...names].sort()
  }, [decks])

  if (selectedDeckId) {
    return (
      <div className="space-y-3 min-w-0">
        <button
          type="button"
          onClick={() => onSelectDeck(null)}
          className={cn("inline-flex items-center gap-1.5 text-sm font-medium", chrome.p.iconText)}
        >
          <ChevronLeft className="h-4 w-4" />
          All flashcards
        </button>
        <InstructorFlashcardDeckEditor
          deckId={selectedDeckId}
          topicNames={topicNames}
          onReload={onReload}
          onDeleted={() => onSelectDeck(null)}
          onCreateDeck={() => void createDeck()}
          navigation={
            orderedDecks.length > 1
              ? {
                  currentIndex: selectedIndex,
                  total: orderedDecks.length,
                  onPrevious: goToPreviousDeck,
                  onNext: goToNextDeck,
                }
              : undefined
          }
        />
        <InstructorFlashcardGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={async (deckId) => {
            await onReload()
            onSelectDeck(deckId)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 min-w-0">
      <FacultyIntegratedToolbar
        moduleId={MODULE_ID}
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search decks…"
        filters={
          <>
            <Select value={topicSelect} onValueChange={setTopicSelect}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(topicSelect !== "all")}>
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topicOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(statusFilter !== "all")}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        trailing={
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5"
              onClick={() => setGenerateOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">From bank</span>
            </Button>
            <Button size="sm" className={cn("h-9 shrink-0 gap-1.5", chrome.cta)} onClick={() => void createDeck()}>
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">New deck</span>
            </Button>
          </>
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {formatContentCount(filteredDecks.length, "deck")}
            {sessions.length > 0
              ? ` · ${formatContentCount(sessions.length, "section")}`
              : ""}
          </p>
        }
      />

      {viewMode === "list" ? (
        <section className={cn(PORTAL_CARD, "flex flex-col gap-3 p-4")}>
          {topicFilter ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--sidebar-accent)]/50 px-2 py-1.5 text-xs">
              <span className="truncate flex-1">{topicFilter}</span>
              <button
                type="button"
                onClick={onClearTopicFilter}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {filteredDecks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-10 text-center">
              <Layers className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No decks match your filters.</p>
              <Button size="sm" className={cn("mt-4", chrome.cta)} onClick={() => void createDeck()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New deck
              </Button>
            </div>
          ) : (
            <>
              <FlashcardDeckList
                decks={pageDeckItems}
                selectedDeckId={selectedDeckId}
                onSelectDeck={onSelectDeck}
              />
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={orderedDecks.length}
                pageSize={FLASHCARD_DECK_PAGE_SIZE}
                onPageChange={setListPage}
              />
            </>
          )}
        </section>
      ) : (
        <section className={cn(PORTAL_CARD, "flex min-w-0 flex-col gap-3 p-4")}>
          {topicFilter ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--sidebar-accent)]/50 px-2 py-1.5 text-xs">
              <span className="truncate flex-1">{topicFilter}</span>
              <button
                type="button"
                onClick={onClearTopicFilter}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {filteredDecks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-10 text-center">
              <Layers className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No decks match your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pageDeckItems.map((deck) => (
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
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={orderedDecks.length}
                pageSize={FLASHCARD_DECK_PAGE_SIZE}
                onPageChange={setListPage}
              />
            </>
          )}
        </section>
      )}

      <InstructorFlashcardGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={async (deckId) => {
          await onReload()
          onSelectDeck(deckId)
        }}
      />
    </div>
  )
}
