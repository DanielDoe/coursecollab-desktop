"use client"


import { getStudentData, studentApiFetch } from "@/lib/auth"
import { useStudentAnnouncementsQuery } from "@/hooks/data/use-student-announcements-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { useState, useEffect, useMemo, useRef } from "react"
import { AnnouncementCardRedesign } from "./announcement-card-redesign"
import { AnnouncementDetailModal } from "./announcement-detail-modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search, Filter, X, CheckCircle2,
  AlertCircle, Inbox, LayoutGrid, List, SlidersHorizontal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
  priority?: 'urgent' | 'important' | 'normal'
  category?: string
  comments_count?: number
  is_read?: boolean
  viewed_by_me?: boolean
  my_reaction?: string | null
  student_content_locked?: boolean
  attachment_count?: number
}

interface AnnouncementsFeedRedesignProps {
  studentId: string
  onViewDetails?: (announcementId: number) => void
  embedInDashboard?: boolean
  /** Open announcement detail modal from notification deep link (?open=id) */
  initialOpenId?: number | null
  /** Hub layout: search/unread live in StudentModuleHubLayout chrome */
  hubLayout?: boolean
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  showUnreadOnly?: boolean
  onShowUnreadOnlyChange?: (value: boolean) => void
  onHubMetaChange?: (meta: { total: number; filtered: number; unread: number; loading: boolean }) => void
}

export function AnnouncementsFeedRedesign({
  studentId,
  onViewDetails,
  embedInDashboard = false,
  initialOpenId = null,
  hubLayout = false,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  showUnreadOnly: showUnreadOnlyProp,
  onShowUnreadOnlyChange,
  onHubMetaChange,
}: AnnouncementsFeedRedesignProps) {
  const {
    announcements,
    isLoading: loading,
    refreshFailed,
    error: queryError,
    refetch,
    setAnnouncements,
  } = useStudentAnnouncementsQuery(studentId)
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load announcements") : null
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  /** Prevent notification deep-link (?open=id) from re-opening modal after the student closes it */
  const deepLinkOpenHandledRef = useRef(false)
  
  // View and filters
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchQueryInternal, setSearchQueryInternal] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showUnreadOnlyInternal, setShowUnreadOnlyInternal] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mostViewed'>('newest')
  const [page, setPage] = useState(1)

  const listPageSize = 6
  const gridPageSize = 6
  const pageSize = viewMode === "grid" ? gridPageSize : listPageSize

  const searchQuery = searchQueryProp ?? searchQueryInternal
  const setSearchQuery = onSearchQueryChange ?? setSearchQueryInternal
  const showUnreadOnly = showUnreadOnlyProp ?? showUnreadOnlyInternal
  const setShowUnreadOnly = onShowUnreadOnlyChange ?? setShowUnreadOnlyInternal


  useEffect(() => {
    if (!initialOpenId || loading || announcements.length === 0) return
    if (deepLinkOpenHandledRef.current) return
    const target = announcements.find((a) => a.id === initialOpenId)
    if (!target) return

    deepLinkOpenHandledRef.current = true
    setSelectedAnnouncement(target)
    setIsModalOpen(true)
    onViewDetails?.(target.id)
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has("open")) {
        url.searchParams.delete("open")
        window.history.replaceState({}, "", url.pathname + url.search + url.hash)
      }
    } catch {
      /* ignore */
    }
  }, [initialOpenId, loading, announcements, onViewDetails])

  const categories = useMemo(() => 
    [...new Set(announcements.map(a => a.category).filter(Boolean))],
    [announcements]
  )

  const filteredAnnouncements = useMemo(() => {
    let filtered = [...announcements]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(query) ||
        (!a.student_content_locked && (a.content ?? "").toLowerCase().includes(query)) ||
        a.author_name?.toLowerCase().includes(query)
      )
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter(a => 
        a.category && selectedCategories.includes(a.category)
      )
    }

    if (showUnreadOnly) {
      filtered = filtered.filter(a => !a.is_read)
    }

    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1

      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'mostViewed':
          return b.views_count - a.views_count
        default:
          return 0
      }
    })

    return filtered
  }, [announcements, searchQuery, selectedCategories, showUnreadOnly, sortBy])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, selectedCategories, showUnreadOnly, sortBy, viewMode])

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pagedAnnouncements = filteredAnnouncements.slice(pageStart, pageStart + pageSize)
  const rangeStart = filteredAnnouncements.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + pageSize, filteredAnnouncements.length)

  const unreadCount = announcements.filter(a => !a.is_read).length
  const activeFiltersCount = selectedCategories.length + (showUnreadOnly && !hubLayout ? 1 : 0)

  useEffect(() => {
    onHubMetaChange?.({
      total: announcements.length,
      filtered: filteredAnnouncements.length,
      unread: unreadCount,
      loading,
    })
  }, [announcements.length, filteredAnnouncements.length, unreadCount, loading, onHubMetaChange])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCategories([])
    setShowUnreadOnly(false)
  }

  const handleCardReaction = async (announcement: Announcement, reactionType: string) => {
    try {
      const response = await studentApiFetch(`/api/announcements/${announcement.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, reactionType }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to react")
      }

      setAnnouncements((prev) =>
        prev.map((a) => {
          if (a.id !== announcement.id) return a

          const breakdown = { ...(a.reactions_breakdown || {}) }
          if (a.my_reaction && breakdown[a.my_reaction]) {
            breakdown[a.my_reaction] = Math.max(0, breakdown[a.my_reaction] - 1)
            if (breakdown[a.my_reaction] === 0) delete breakdown[a.my_reaction]
          }

          let reactionsCount = Number(a.reactions_count || 0)
          if (data.action === "removed") {
            reactionsCount = Math.max(0, reactionsCount - 1)
          } else if (!a.my_reaction) {
            reactionsCount += 1
          }

          if (data.action !== "removed") {
            breakdown[reactionType] = (breakdown[reactionType] || 0) + 1
          }

          return {
            ...a,
            my_reaction: data.action === "removed" ? null : reactionType,
            reactions_breakdown: breakdown,
            reactions_count: reactionsCount,
          }
        }),
      )
    } catch (error) {
      console.error("Error reacting:", error)
    }
  }

  const feedCardShell = "rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"

  if (loading) {
    const skeleton = (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2 py-4 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-[var(--muted)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--muted)]" />
            <div className="h-12 w-full rounded bg-[var(--muted)]" />
          </div>
        ))}
      </div>
    )
    if (hubLayout) return skeleton
    return embedInDashboard ? (
      <div className={feedCardShell}>
        <div className="p-4 sm:p-5">{skeleton}</div>
      </div>
    ) : (
      skeleton
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200/80 dark:border-red-800/50 bg-[var(--card)] p-6 sm:p-8 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-[var(--cc-text)] mb-2">Connection Error</h3>
        <p className="text-sm text-[var(--cc-text-muted)] mb-4">{error}</p>
        <Button onClick={() => void refetch()} variant="outline" size="sm" className="rounded-xl">
          Try Again
        </Button>
      </div>
    )
  }

  if (announcements.length === 0) {
    const sectionLabel =
      getStudentData()?.section?.trim() ||
      getStudentData()?.courseCode?.trim() ||
      null
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--cc-accent-soft)] flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-[var(--cc-accent-dark)]" />
        </div>
        <h3 className="text-lg font-bold text-[var(--cc-text)] mb-2">No Announcements Yet</h3>
        <p className="text-sm text-[var(--cc-text-muted)] max-w-md mx-auto">
          {sectionLabel
            ? `Nothing has been posted for ${sectionLabel} yet. Instructors can publish course-wide or section-specific updates here.`
            : "Check back later for important updates from your instructors."}
        </p>
      </div>
    )
  }

  const toolbar = (
    <>
      {!embedInDashboard && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--cc-text-muted)]">
            {filteredAnnouncements.length} posts
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" onClick={() => setViewMode("list")} size="icon" className={cn("h-8 w-8", viewMode === "list" && "bg-[var(--muted)]")} aria-label="List view">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setViewMode("grid")} size="icon" className={cn("h-8 w-8", viewMode === "grid" && "bg-[var(--muted)]")} aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className={cn("flex items-center gap-1.5 sm:gap-2", hubLayout && "justify-end")}>
        {!hubLayout ? (
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <Input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "h-10 rounded-full pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
              embedInDashboard
                ? "border border-[var(--border)] bg-[var(--muted)]/40"
                : "border-0 bg-[var(--muted)]",
            )}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full p-0"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-full",
                    selectedCategories.length > 0 && "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
                  )}
                  aria-label="Filter by category"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 sm:w-56">
                <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category}
                    checked={selectedCategories.includes(category!)}
                    onCheckedChange={(checked) => {
                      setSelectedCategories((prev) =>
                        checked ? [...prev, category!] : prev.filter((c) => c !== category),
                      )
                    }}
                  >
                    {category}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Sort announcements">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 sm:w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mostViewed">Most viewed</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn(
              "h-10 w-10 rounded-full",
              showUnreadOnly && "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] hover:text-white",
              hubLayout && "hidden",
            )}
            title="Unread only"
            aria-label="Unread only"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 rounded-full text-[var(--cc-accent-dark)]"
              aria-label={`Clear ${activeFiltersCount} filters`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {embedInDashboard && (
            <>
              <Button
                variant="ghost"
                onClick={() => setViewMode("list")}
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full",
                  viewMode === "list"
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)]",
                )}
                title="List view"
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setViewMode("grid")}
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full",
                  viewMode === "grid"
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)]",
                )}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )

  const feedBody = (
    <AnimatePresence mode="popLayout">
      {filteredAnnouncements.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--cc-text)] mb-1">No results</h3>
          <p className="text-sm text-[var(--cc-text-muted)]">Try a different search or filter</p>
        </motion.div>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid gap-3 sm:grid-cols-2 sm:gap-4 auto-rows-fr p-4 sm:p-5"
              : "space-y-2 p-4 sm:p-5",
          )}
        >
          {pagedAnnouncements.map((announcement, index) => (
            <motion.div
              key={announcement.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.03 }}
              className={viewMode === "grid" ? "h-full" : undefined}
            >
              <AnnouncementCardRedesign
                announcement={announcement}
                variant="student"
                displayMode={viewMode}
                onView={() => {
                  setSelectedAnnouncement(announcement)
                  setIsModalOpen(true)
                }}
                onReact={(reaction) => handleCardReaction(announcement, reaction)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  )

  const pagination =
    filteredAnnouncements.length > pageSize ? (
      <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-center text-xs tabular-nums text-[var(--cc-text-muted)] sm:text-left">
          {rangeStart}–{rangeEnd} of {filteredAnnouncements.length}
        </p>
        <Pagination className="mx-0 w-auto justify-center sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (safePage > 1) setPage(safePage - 1)
                }}
                className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                aria-disabled={safePage <= 1}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <PaginationItem key={pageNumber} className="hidden sm:list-item">
                <PaginationLink
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setPage(pageNumber)
                  }}
                  isActive={safePage === pageNumber}
                  className="cursor-pointer"
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (safePage < totalPages) setPage(safePage + 1)
                }}
                className={
                  safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
                aria-disabled={safePage >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    ) : null

  return (
    <div className="space-y-5 w-full min-w-0 overflow-visible">
      <StaleRefreshHint visible={refreshFailed} onRetry={() => void refetch()} />
      {hubLayout ? (
        <>
          {announcements.length > 0 ? <div className="mb-3">{toolbar}</div> : null}
          {feedBody}
          {pagination}
        </>
      ) : embedInDashboard ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={feedCardShell}
        >
          <div className="p-4 sm:p-5">{toolbar}</div>
          {feedBody}
          {pagination}
        </motion.section>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {toolbar}
          </motion.div>
          {feedBody}
          {pagination}
        </>
      )}

      {/* Announcement Detail Modal */}
      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        studentId={studentId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedAnnouncement(null)
        }}
        onReactionChange={(reaction) => {
          if (selectedAnnouncement) {
            setSelectedAnnouncement({
              ...selectedAnnouncement,
              my_reaction: reaction
            })
            // Update in announcements list
            setAnnouncements(prev => prev.map(a => 
              a.id === selectedAnnouncement.id 
                ? { ...a, my_reaction: reaction }
                : a
            ))
          }
        }}
        onViewCountChange={(announcementId, totalViews) => {
          setAnnouncements((prev) =>
            prev.map((a) =>
              a.id === announcementId
                ? { ...a, views_count: totalViews, viewed_by_me: true, is_read: true }
                : a,
            ),
          )
          setSelectedAnnouncement((prev) =>
            prev && prev.id === announcementId
              ? { ...prev, views_count: totalViews, viewed_by_me: true, is_read: true }
              : prev,
          )
        }}
      />
    </div>
  )
}
