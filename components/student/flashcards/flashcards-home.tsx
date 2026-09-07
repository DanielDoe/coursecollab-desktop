"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FlashcardDeck } from "@/lib/flashcards"
import { useStudentFlashcardsQuery } from "@/hooks/data/use-student-flashcards-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { FlashcardDeckCard } from "@/components/student/flashcards/flashcard-deck-card"
import { FlashcardDeckListCard } from "@/components/student/flashcards/flashcard-deck-list-card"
import { FlashcardGamificationBanner } from "@/components/student/flashcards/FlashcardGamificationBanner"
import { useFlashcardDeckMastery } from "@/components/student/flashcards/use-flashcard-deck-mastery"
import {
  CreateDeckDialog,
  type CreateDeckDraft,
} from "@/components/student/flashcards/create-deck-dialog"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { cn } from "@/lib/utils"
import { BookOpen, ChevronLeft, ChevronRight, LayoutGrid, Layers, List, Loader2, Plus, Search, Trophy, UserRound } from "lucide-react"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import {
  DesktopChromeTitle,
  DesktopChromeTitleActions,
} from "@/components/desktop/DesktopLangSmithChrome"
import { DesktopFlashcardDeckCard } from "@/components/student/flashcards/desktop-flashcard-deck-card"
import { toast } from "@/lib/app-toast"
import { useFlashcardChrome } from "@/hooks/use-flashcard-chrome"
import { DESKTOP_BTN, DESKTOP_BTN_GHOST, DESKTOP_BTN_OUTLINE, DESKTOP_SELECT, DESKTOP_SEGMENTED } from "@/lib/desktop-native-ui"

type Props = {
  practiceHubOnly?: boolean
  embedded?: boolean
}

type DeckFilter = "all" | "course" | "mine"
type DeckSort = "recent" | "title" | "cards"
type CardsFilter = "all" | "with-cards" | "empty"

const DESKTOP_GRID_PAGE_SIZE = 8
const DESKTOP_LIST_PAGE_SIZE = 8

function applyDeckFilters(
  decks: FlashcardDeck[],
  {
    search,
    sort,
    cardsFilter,
    topicFilter,
  }: {
    search: string
    sort: DeckSort
    cardsFilter: CardsFilter
    topicFilter: string
  },
) {
  const q = search.trim().toLowerCase()
  let next = decks.filter((deck) => {
    if (cardsFilter === "with-cards" && deck.cardCount <= 0) return false
    if (cardsFilter === "empty" && deck.cardCount > 0) return false
    if (topicFilter !== "all" && (deck.topic?.trim() ?? "") !== topicFilter) return false
    if (!q) return true
    return (
      deck.title.toLowerCase().includes(q) ||
      deck.description.toLowerCase().includes(q) ||
      (deck.topic?.toLowerCase().includes(q) ?? false)
    )
  })

  next = [...next].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title)
    if (sort === "cards") return b.cardCount - a.cardCount || a.title.localeCompare(b.title)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return next
}

export function FlashcardsHome({ practiceHubOnly = false, embedded = false }: Props) {
  const desktopChrome = isDesktopAppShell()
  const { roles: ROLES } = useFlashcardChrome()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(0)
  const {
    courseDecks,
    myDecks,
    isLoading: loading,
    refreshFailed,
    refetch,
    createDeck,
  } = useStudentFlashcardsQuery(practiceHubOnly)
  const creating = createDeck.isPending
  const [menuView, setMenuView] = useState<DeckFilter>(practiceHubOnly ? "course" : "all")
  const [showStats, setShowStats] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<DeckSort>("recent")
  const [cardsFilter, setCardsFilter] = useState<CardsFilter>("all")
  const [topicFilter, setTopicFilter] = useState("all")
  const deckMastery = useFlashcardDeckMastery()

  const handleCreateDeck = async (draft: CreateDeckDraft) => {
    try {
      const deck = await createDeck.mutateAsync(draft)
      setCreateOpen(false)
      router.push(`/student/dashboard-v2/flashcards/${deck.id}/edit`)
    } catch (err: unknown) {
      toast.error("Could not create deck", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const allDecks = useMemo(() => [...courseDecks, ...myDecks], [courseDecks, myDecks])

  const decksForFilter = useMemo(() => {
    if (menuView === "course") return courseDecks
    if (menuView === "mine") return myDecks
    return allDecks
  }, [menuView, courseDecks, myDecks, allDecks])

  const topicOptions = useMemo(() => {
    const topics = new Set<string>()
    for (const deck of decksForFilter) {
      const topic = deck.topic?.trim()
      if (topic) topics.add(topic)
    }
    return [...topics].sort((a, b) => a.localeCompare(b))
  }, [decksForFilter])

  const filteredDecks = useMemo(
    () =>
      applyDeckFilters(decksForFilter, {
        search,
        sort,
        cardsFilter,
        topicFilter,
      }),
    [decksForFilter, search, sort, cardsFilter, topicFilter],
  )

  useEffect(() => {
    setPage(0)
  }, [search, sort, cardsFilter, topicFilter, menuView, viewMode])

  const pageSize = viewMode === "list" ? DESKTOP_LIST_PAGE_SIZE : DESKTOP_GRID_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(filteredDecks.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * pageSize
  const pagedDecks = filteredDecks.slice(pageStart, pageStart + pageSize)
  const rangeStart = filteredDecks.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + pageSize, filteredDecks.length)

  const deckCounts: Record<DeckFilter, number> = {
    all: allDecks.length,
    course: courseDecks.length,
    mine: myDecks.length,
  }

  const activeToolbarFilters =
    (sort !== "recent" ? 1 : 0) + (cardsFilter !== "all" ? 1 : 0) + (topicFilter !== "all" ? 1 : 0)

  const renderDeckGrid = (decks: FlashcardDeck[], mode: "grid" | "list" = viewMode) => {
    if (decks.length === 0) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-10 text-center">
          <Layers className="mx-auto h-8 w-8 text-[var(--cc-accent)]" />
          <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">
            {search.trim() || activeToolbarFilters > 0
              ? "No decks match"
              : practiceHubOnly
                ? "No Practice Hub decks yet"
                : "No flashcard decks yet"}
          </p>
          <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
            {search.trim() || activeToolbarFilters > 0
              ? "Try another search or filter."
              : practiceHubOnly
                ? "Your instructor can publish decks from Content → Flashcards."
                : "Create a deck or wait for course materials."}
          </p>
        </div>
      )
    }

    if (mode === "list") {
      return (
        <div className="flex flex-col gap-2">
          {decks.map((deck, index) => (
            <FlashcardDeckListCard
              key={deck.id}
              deck={deck}
              colorIndex={index}
              mastery={deckMastery[String(deck.id)] ?? null}
              studyHref={`/student/dashboard-v2/flashcards/${deck.id}`}
              editHref={
                deck.canEdit ? `/student/dashboard-v2/flashcards/${deck.id}/edit` : undefined
              }
              compact
            />
          ))}
        </div>
      )
    }

    return (
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck, index) => (
          <FlashcardDeckCard
            key={deck.id}
            deck={deck}
            layout="grid"
            colorIndex={index}
            mastery={deckMastery[String(deck.id)] ?? null}
            studyHref={`/student/dashboard-v2/flashcards/${deck.id}`}
            editHref={
              deck.canEdit ? `/student/dashboard-v2/flashcards/${deck.id}/edit` : undefined
            }
            compact={embedded}
          />
        ))}
      </div>
    )
  }

  const flashcardsMeta = showStats
    ? "Progress and weekly leaderboard"
    : [
        `${filteredDecks.length} shown`,
        `${deckCounts.mine} mine`,
        `${deckCounts.course} course`,
        activeToolbarFilters > 0 ? `${activeToolbarFilters} filters` : null,
      ]
        .filter(Boolean)
        .join(" · ")

  const desktopChromeSlots = desktopChrome ? (
    <>
      <DesktopChromeTitle>
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="shrink-0 truncate text-[16px] font-semibold tracking-tight">Flashcards</h1>
          <span className="shrink-0 text-[12px] text-[#6b7280] dark:text-[#9ca3af]" aria-hidden>
            ·
          </span>
          <p className="min-w-0 truncate text-[12px] leading-4 text-[#6b7280] dark:text-[#9ca3af]">
            {flashcardsMeta}
          </p>
        </div>
      </DesktopChromeTitle>
      <DesktopChromeTitleActions>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cn(
              DESKTOP_BTN_GHOST,
              showStats && "bg-[#eef2ff] text-[#1e3a8a] hover:bg-[#eef2ff] dark:bg-[#1e1b4b]/60 dark:text-[#c7d2fe]",
            )}
            onClick={() => setShowStats((open) => !open)}
          >
            <Trophy className="size-3.5" />
            My stats
          </button>
          <button
            type="button"
            className={DESKTOP_BTN}
            style={{ backgroundColor: ROLES.create.fill, color: ROLES.create.icon }}
            onClick={() => setCreateOpen(true)}
            disabled={creating}
          >
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            New deck
          </button>
        </div>
      </DesktopChromeTitleActions>
    </>
  ) : null

  const browseSideMenu = (
    <FacultyModuleSideMenu
      embedded
      className="lg:border-r lg:border-[var(--border)] lg:pr-4"
      moduleId="practice"
      accent={{ soft: "var(--cc-accent-soft)", ink: "var(--cc-text)" }}
      title="Browse"
      activeId={menuView}
      onSelect={(id) => {
        setMenuView(id as DeckFilter)
        setShowStats(false)
      }}
      items={[
        { id: "all", label: "All decks", icon: Layers, badge: deckCounts.all },
        { id: "course", label: "Course", icon: BookOpen, badge: deckCounts.course },
        { id: "mine", label: "My decks", icon: UserRound, badge: deckCounts.mine },
      ]}
    />
  )

  if (loading) {
    return (
      <>
        {desktopChromeSlots}
        <div className="border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4">
          <ModuleListSkeleton rows={6} className="min-h-[280px]" />
        </div>
      </>
    )
  }

  const refreshHint = <StaleRefreshHint visible={refreshFailed} onRetry={() => void refetch()} />

  if (practiceHubOnly || embedded) {
    return <div className="space-y-3">{refreshHint}{renderDeckGrid(courseDecks)}</div>
  }

  if (desktopChrome) {
    return (
      <div
        data-desktop-flashcards-workspace
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4"
      >
        {desktopChromeSlots}
        {refreshHint}
        <div className="flex h-10 min-w-0 items-center gap-2">
          <div className="relative h-10 min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search decks…"
              disabled={showStats}
              className="box-border h-10 w-full rounded-full border-0 bg-[var(--sidebar-accent)]/50 pl-10 pr-3 text-sm text-[#111827] outline-none placeholder:text-[#9ca3af] focus-visible:bg-[var(--sidebar-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30 disabled:opacity-50 dark:text-[#f3f4f6]"
            />
          </div>
          <div className={DESKTOP_SEGMENTED}>
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                viewMode === "grid" ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]" : "text-[#6b7280]",
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                viewMode === "list" ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]" : "text-[#6b7280]",
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as DeckSort)}>
            <SelectTrigger className={cn(DESKTOP_SELECT, "w-[7rem]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="cards">Most cards</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cardsFilter} onValueChange={(value) => setCardsFilter(value as CardsFilter)}>
            <SelectTrigger className={cn(DESKTOP_SELECT, "w-[8rem]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decks</SelectItem>
              <SelectItem value="with-cards">Has cards</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
            </SelectContent>
          </Select>
          {topicOptions.length > 0 ? (
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className={cn(DESKTOP_SELECT, "w-[8rem]")}>
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topicOptions.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <FacultyModuleSplitLayout
          className="min-h-0 flex-1 gap-3"
          menuWidthClass="lg:w-52"
          menu={browseSideMenu}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {showStats ? (
              <FlashcardGamificationBanner topicFilter={topicFilter} />
            ) : filteredDecks.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Layers className="mx-auto size-5 text-[#9ca3af]" />
                <p className="mt-2 text-[13px] font-medium text-[#111827] dark:text-[#f3f4f6]">
                  {search.trim() || activeToolbarFilters > 0 ? "No decks match" : "No flashcard decks yet"}
                </p>
                <p className="mt-1 text-[12px] text-[#6b7280]">
                  {search.trim() || activeToolbarFilters > 0
                    ? "Try another search or filter."
                    : "Create a deck or wait for course materials."}
                </p>
              </div>
            ) : (
              <div
                key={`${menuView}|${search}|${sort}|${cardsFilter}|${topicFilter}|${safePage}|${viewMode}`}
                className={
                  viewMode === "list"
                    ? "flex flex-col gap-1.5"
                    : "grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2"
                }
              >
                {pagedDecks.map((deck, index) => (
                  <DesktopFlashcardDeckCard
                    key={deck.id}
                    deck={deck}
                    index={index}
                    layout={viewMode}
                    mastery={deckMastery[String(deck.id)] ?? null}
                    studyHref={`/student/dashboard-v2/flashcards/${deck.id}`}
                    editHref={
                      deck.canEdit ? `/student/dashboard-v2/flashcards/${deck.id}/edit` : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </FacultyModuleSplitLayout>
        {!showStats && filteredDecks.length > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e5e7eb] pt-3 dark:border-[#262626]">
            <p className="text-[12px] text-[#6b7280]">
              {rangeStart}–{rangeEnd} of {filteredDecks.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={DESKTOP_BTN_OUTLINE}
                disabled={safePage <= 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <span className="px-1.5 text-[12px] tabular-nums text-[#6b7280]">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className={DESKTOP_BTN_OUTLINE}
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
        <CreateDeckDialog
          open={createOpen}
          creating={creating}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreateDeck}
        />
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4">
      {refreshHint}
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Flashcards
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
              {showStats
                ? "Progress and weekly leaderboard"
                : `${filteredDecks.length} shown`}
              {!showStats ? (
                <span className="text-[var(--cc-text-muted)]">
                  {" "}
                  · {deckCounts.mine} mine · {deckCounts.course} course
                  {activeToolbarFilters > 0 ? ` · ${activeToolbarFilters} filters` : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-9 rounded-xl px-2.5",
                showStats
                  ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                  : "text-[var(--cc-text-muted)]",
              )}
              onClick={() => setShowStats((open) => !open)}
            >
              <Trophy className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">My stats</span>
            </Button>
            <Button
              type="button"
              className="h-9 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
              style={{ backgroundColor: ROLES.create.fill, color: ROLES.create.icon }}
              onClick={() => setCreateOpen(true)}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">New deck</span>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="relative h-10 min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search decks…"
              disabled={showStats}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 pl-10 pr-3 text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] outline-none focus:border-[var(--cc-accent)]/40 disabled:opacity-50"
            />
          </div>
          <div className="flex h-10 shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-1">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                viewMode === "grid"
                  ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                  : "text-[var(--cc-text-muted)]",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                viewMode === "list"
                  ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                  : "text-[var(--cc-text-muted)]",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as DeckSort)}>
            <SelectTrigger className="h-10 w-[7.25rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="cards">Most cards</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cardsFilter} onValueChange={(value) => setCardsFilter(value as CardsFilter)}>
            <SelectTrigger className="hidden h-10 w-[8rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 sm:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decks</SelectItem>
              <SelectItem value="with-cards">Has cards</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
            </SelectContent>
          </Select>
          {topicOptions.length > 0 ? (
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="hidden h-10 w-[8rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 md:flex">
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topicOptions.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <FacultyModuleSplitLayout className="gap-3" menuWidthClass="lg:w-52" menu={browseSideMenu}>
        {showStats ? (
          <FlashcardGamificationBanner topicFilter={topicFilter} />
        ) : (
          renderDeckGrid(filteredDecks)
        )}
      </FacultyModuleSplitLayout>

      {allDecks.length > 0 ? (
        <p className="text-xs text-[var(--cc-text-muted)]">
          Also available in{" "}
          <Link
            href="/student/dashboard-v2/practice"
            className="underline underline-offset-2 text-[var(--cc-accent)]"
          >
            Practice Hub
          </Link>{" "}
          when your instructor publishes decks there.
        </p>
      ) : null}

      <CreateDeckDialog
        open={createOpen}
        creating={creating}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateDeck}
      />
    </div>
  )
}
