"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  displayContentTitle,
  FacultySidebarPagination,
  pageForContentIndex,
} from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { FlashcardDeckList, FLASHCARD_DECK_PAGE_SIZE, type FlashcardDeckListItem } from "@/components/instructor/flashcards/flashcard-deck-card"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import { InstructorFlashcardDeckEditor } from "@/components/instructor/flashcards/instructor-flashcard-deck-editor"
import { FlashcardTopicCard } from "@/components/instructor/flashcards/flashcard-topic-card"
import { useInstructorFlashcardSessions } from "@/components/instructor/flashcards/use-instructor-flashcard-sessions"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { ArrowLeft, FolderOpen, Loader2, Sparkles } from "lucide-react"
import { InstructorFlashcardGenerateDialog } from "@/components/instructor/flashcards/instructor-flashcard-generate-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/app-toast"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"

const MODULE_ID = "flashcards"

type FlashcardTopic = {
  name: string
  deck_count: number
  card_count: number
}

type Props = {
  decks: FlashcardDeck[]
  onReload: () => Promise<void>
}

export function InstructorFlashcardsTopicsView({ decks, onReload }: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const scopeKey = useInstructorScopeKey()
  const { sessions } = useInstructorFlashcardSessions()
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<FlashcardTopic[]>([])
  const [session, setSession] = useState("SCOPED")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null)
  const [listPage, setListPage] = useState(1)
  const [generateOpen, setGenerateOpen] = useState(false)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const url =
        session === "SCOPED"
          ? "/api/instructor/flashcards/topics"
          : `/api/instructor/flashcards/topics?session=${encodeURIComponent(session)}`
      const res = await instructorApiFetch(url, { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load topics")
      setTopics(data.topics || [])
    } catch (err: unknown) {
      toast.error("Could not load topics", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [session, scopeKey])

  useEffect(() => {
    void loadTopics()
  }, [loadTopics])

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return topics
    return topics.filter((t) => t.name.toLowerCase().includes(term))
  }, [topics, search])

  const topicDecks = useMemo(() => {
    if (!selectedTopic) return []
    const term = search.trim().toLowerCase()
    return decks
      .filter((d) => {
        if ((d.topic?.trim() || "General") !== selectedTopic) return false
        if (!term) return true
        return d.title.toLowerCase().includes(term)
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [decks, selectedTopic, search])

  const totalListPages = Math.max(1, Math.ceil(topicDecks.length / FLASHCARD_DECK_PAGE_SIZE))
  const pageDecks = useMemo(() => {
    const start = (listPage - 1) * FLASHCARD_DECK_PAGE_SIZE
    return topicDecks.slice(start, start + FLASHCARD_DECK_PAGE_SIZE)
  }, [topicDecks, listPage])

  const pageDeckItems = useMemo(
    (): FlashcardDeckListItem[] =>
      pageDecks.map((deck) => ({
        id: deck.id,
        title: displayContentTitle(deck.title),
        description: deck.description,
        topic: selectedTopic ?? undefined,
        cardCount: deck.cardCount,
        isPublished: deck.isPublished,
        showInPracticeHub: deck.showInPracticeHub,
        updatedAt: deck.updatedAt,
      })),
    [pageDecks, selectedTopic],
  )

  const selectedIndex = useMemo(
    () => (selectedDeckId ? topicDecks.findIndex((deck) => deck.id === selectedDeckId) : -1),
    [topicDecks, selectedDeckId],
  )

  useEffect(() => {
    setListPage(1)
  }, [selectedTopic, search])

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages)
  }, [listPage, totalListPages])

  useEffect(() => {
    if (selectedIndex >= 0) setListPage(pageForContentIndex(selectedIndex, FLASHCARD_DECK_PAGE_SIZE))
  }, [selectedIndex])

  const goToPreviousDeck = useCallback(() => {
    if (selectedIndex > 0) setSelectedDeckId(topicDecks[selectedIndex - 1]!.id)
  }, [selectedIndex, topicDecks])

  const goToNextDeck = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < topicDecks.length - 1) {
      setSelectedDeckId(topicDecks[selectedIndex + 1]!.id)
    }
  }, [selectedIndex, topicDecks])

  const openTopic = (name: string) => {
    setSelectedTopic(name)
    setSelectedDeckId(null)
  }

  const topicNames = useMemo(() => topics.map((t) => t.name), [topics])

  if (selectedTopic && selectedDeckId) {
    return (
      <div className="space-y-3 min-w-0">
        <button
          type="button"
          onClick={() => setSelectedDeckId(null)}
          className={cn("inline-flex items-center gap-1.5 text-sm font-medium", chrome.p.iconText)}
        >
          <ArrowLeft className="h-4 w-4" />
          {selectedTopic}
        </button>
        <InstructorFlashcardDeckEditor
          deckId={selectedDeckId}
          topicNames={topicNames}
          onReload={onReload}
          onDeleted={() => setSelectedDeckId(null)}
          showCreatePrompt={false}
          navigation={
            topicDecks.length > 1
              ? {
                  currentIndex: selectedIndex,
                  total: topicDecks.length,
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
            await loadTopics()
            setSelectedDeckId(deckId)
          }}
        />
      </div>
    )
  }

  if (loading && topics.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className={cn("h-6 w-6 animate-spin", chrome.p.iconText)} />
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
        searchPlaceholder={selectedTopic ? "Search decks in topic…" : "Search topics…"}
        filters={
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className={facultyToolbarSelectTriggerClass(session !== "SCOPED")}>
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SCOPED">Selected section</SelectItem>
              <SelectItem value="ALL">All sections</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={`section-${s.id}-${s.code}`} value={s.code}>
                  {s.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        viewMode={selectedTopic ? undefined : viewMode}
        onViewModeChange={selectedTopic ? undefined : setViewMode}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {selectedTopic ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedTopic(null)
                  setSelectedDeckId(null)
                }}
                className="inline-flex items-center gap-1 text-xs text-[var(--cc-accent)] hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                All topics
              </button>
            ) : null}
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {selectedTopic
                ? `${topicDecks.length} deck${topicDecks.length === 1 ? "" : "s"} in ${selectedTopic}`
                : `${filteredTopics.length} topic${filteredTopics.length === 1 ? "" : "s"}`}
            </span>
          </div>
        }
        trailing={
          !selectedTopic ? (
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5"
              onClick={() => setGenerateOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">From bank</span>
            </Button>
          ) : undefined
        }
      />

      {!selectedTopic ? (
        filteredTopics.length === 0 ? (
          <div className={cn(PORTAL_CARD, "px-4 py-10 text-center")}>
            <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No topics yet. Create a deck under All Flashcards and assign a topic.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {filteredTopics.map((topic) => (
              <FlashcardTopicCard
                key={topic.name}
                topic={topic}
                viewMode="list"
                onOpen={() => openTopic(topic.name)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTopics.map((topic) => (
              <FlashcardTopicCard
                key={topic.name}
                topic={topic}
                viewMode="grid"
                onOpen={() => openTopic(topic.name)}
              />
            ))}
          </div>
        )
      ) : (
        <section className={cn(PORTAL_CARD, "flex flex-col gap-3 p-4")}>
          {topicDecks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No decks in this topic. Add one from All Flashcards.
            </p>
          ) : (
            <>
              <FlashcardDeckList
                decks={pageDeckItems}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
              />
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={topicDecks.length}
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
          await loadTopics()
          const deck = decks.find((d) => d.id === deckId)
          setSelectedTopic(deck?.topic?.trim() || selectedTopic || "General")
          setSelectedDeckId(deckId)
        }}
      />
    </div>
  )
}
