"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState, useMemo } from "react"
import { useFacultyAnnouncementsQuery } from "@/hooks/data/use-faculty-announcements-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { useRouter } from "next/navigation"
import { Plus, ArrowLeft, Megaphone, RefreshCw, Filter, SlidersHorizontal, X, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnnouncementCardRedesign } from "@/components/announcement-card-redesign"
import { AnnouncementDetailModal } from "@/components/announcement-detail-modal"
import { AnnouncementForm } from "@/components/announcement-form"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { FacultyIntegratedToolbar, facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"

interface Announcement {
  id: number
  title: string
  content: string
  author_name: string
  pinned: boolean
  allow_reactions: boolean
  allow_comments: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
  category?: string
  student_content_locked?: boolean
  attachment_count?: number
  ai_summary?: string | null
}

const cardBase = PORTAL_CARD

export function InstructorAnnouncementsContent({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("announcements")
  const fp = chrome.p
  const router = useRouter()
  const { toast } = useToast()
  const [instructorId, setInstructorId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return ""
      return String(JSON.parse(raw).id ?? "")
    } catch {
      return ""
    }
  })
  const [courseId, setCourseId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return ""
      const id = JSON.parse(raw).selectedCourseId
      return id != null ? String(id) : ""
    } catch {
      return ""
    }
  })
  const announcementsQuery = useFacultyAnnouncementsQuery(instructorId, courseId || null)
  const announcements = announcementsQuery.announcements as Announcement[]
  const loading = announcementsQuery.isLoading
  const setAnnouncements = announcementsQuery.setAnnouncements as (next: Announcement[]) => void
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  
  // View and filters
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mostViewed'>('newest')
  const [activeMenu, setActiveMenu] = useState<"overview" | "pinned">("overview")

  const fetchAnnouncements = () => {
    void announcementsQuery.refetch()
  }

  useEffect(() => {
    if (!instructorId) router.push("/faculty/login")
  }, [instructorId, router])

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem("instructorSession")
        if (!raw) return
        const session = JSON.parse(raw) as { id?: unknown; selectedCourseId?: unknown }
        if (session.id != null) setInstructorId(String(session.id))
        setCourseId(session.selectedCourseId != null ? String(session.selectedCourseId) : "")
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("instructor-session-updated", sync)
    window.addEventListener("instructor-course-scope-changed", sync)
    window.addEventListener("instructor-scope-changed", sync)
    return () => {
      window.removeEventListener("instructor-session-updated", sync)
      window.removeEventListener("instructor-course-scope-changed", sync)
      window.removeEventListener("instructor-scope-changed", sync)
    }
  }, [])

  const handleEdit = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setEditDialogOpen(true)
  }

  const handleDelete = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedAnnouncement) return

    try {
      const response = await instructorApiFetch(`/api/announcements/${selectedAnnouncement.id}`, {
        method: 'DELETE',
        headers: {
          'x-instructor-id': instructorId
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete announcement')
      }

      toast({
        title: "Success",
        description: "Announcement deleted successfully"
      })

      setDeleteDialogOpen(false)
      setSelectedAnnouncement(null)
      fetchAnnouncements()
    } catch (error) {
      console.error("Error deleting announcement:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete announcement",
        variant: "destructive"
      })
    }
  }

  const handlePin = async (announcement: Announcement) => {
    try {
      const response = await instructorApiFetch(`/api/announcements/${announcement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-instructor-id': instructorId
        },
        body: JSON.stringify({
          pinned: !announcement.pinned
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update announcement')
      }

      toast({
        title: "Success",
        description: announcement.pinned ? "Announcement unpinned" : "Announcement pinned"
      })

      fetchAnnouncements()
    } catch (error) {
      console.error("Error pinning announcement:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update announcement",
        variant: "destructive"
      })
    }
  }

  const handleLock = async (announcement: Announcement) => {
    const nextLocked = !announcement.student_content_locked
    try {
      const response = await instructorApiFetch(`/api/announcements/${announcement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-instructor-id': instructorId
        },
        body: JSON.stringify({
          student_content_locked: nextLocked
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update announcement')
      }

      const updatedAnnouncement = data.announcement as Announcement | undefined
      const lockedValue =
        updatedAnnouncement?.student_content_locked ?? nextLocked

      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcement.id
            ? {
                ...a,
                ...updatedAnnouncement,
                student_content_locked: lockedValue,
                views_count: Number(updatedAnnouncement?.views_count ?? a.views_count ?? 0),
                reactions_count: Number(updatedAnnouncement?.reactions_count ?? a.reactions_count ?? 0),
              }
            : a,
        ),
      )

      if (selectedAnnouncement?.id === announcement.id) {
        setSelectedAnnouncement((prev) =>
          prev
            ? {
                ...prev,
                ...updatedAnnouncement,
                student_content_locked: lockedValue,
                views_count: Number(updatedAnnouncement?.views_count ?? prev.views_count ?? 0),
                reactions_count: Number(updatedAnnouncement?.reactions_count ?? prev.reactions_count ?? 0),
              }
            : prev,
        )
      }

      toast({
        title: "Success",
        description: nextLocked
          ? "Announcement locked for students — they can see the title only"
          : "Announcement unlocked — students can now view content and files"
      })

      fetchAnnouncements()
    } catch (error) {
      console.error("Error locking announcement:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update announcement",
        variant: "destructive"
      })
    }
  }

  const handleViewDetails = (announcementId: number) => {
    const announcement = announcements.find(a => a.id === announcementId)
    if (announcement) {
      setSelectedAnnouncement(announcement)
      setViewModalOpen(true)
    }
  }

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
        a.content.toLowerCase().includes(query) ||
        a.author_name?.toLowerCase().includes(query)
      )
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter(a => 
        a.category && selectedCategories.includes(a.category)
      )
    }

    // Apply menu filter
    if (activeMenu === "pinned") {
      filtered = filtered.filter(a => a.pinned)
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
  }, [announcements, searchQuery, selectedCategories, sortBy, activeMenu])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCategories([])
  }

  const sortLabels: Record<typeof sortBy, string> = {
    newest: "Newest",
    oldest: "Oldest",
    mostViewed: "Most viewed",
  }

  const stats = {
    total: announcements.length,
    pinned: announcements.filter(a => a.pinned).length,
    totalViews: announcements.reduce((sum, a) => sum + Number(a.views_count || 0), 0),
    totalReactions: announcements.reduce((sum, a) => sum + Number(a.reactions_count || 0), 0)
  }

  if (loading && announcements.length === 0) {
    return (
      <ModuleListSkeleton rows={6} className="py-8" />
    )
  }

  const dashboardHref = embedInDashboard ? FACULTY_DASHBOARD_BASE : "/instructor/dashboard"

  return (
    <>
      <StaleRefreshHint visible={announcementsQuery.refreshFailed} onRetry={fetchAnnouncements} />
    <div className={embedInDashboard ? "space-y-4" : "min-h-screen bg-[var(--background)]"}>
      <div className={embedInDashboard ? "space-y-4" : "container mx-auto space-y-6 px-6 py-10"}>
        {!embedInDashboard ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => router.push(dashboardHref)} className={cn("h-9 gap-2 rounded-lg", chrome.outline)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Announcements
            </p>
            <p className="mt-0.5 text-sm text-[var(--cc-text)]">
              Course updates for students
              <span className="text-[var(--cc-text-muted)]">
                {" "}
                · {stats.total} total
                {stats.pinned > 0 ? ` · ${stats.pinned} pinned` : ""}
                {stats.totalViews > 0 ? ` · ${stats.totalViews} views` : ""}
              </span>
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--muted)]/50 p-1"
            role="tablist"
            aria-label="Announcement views"
          >
            {(
              [
                { id: "overview" as const, label: "All" },
                { id: "pinned" as const, label: "Pinned" },
              ] as const
            ).map((tab) => {
              const isActive = activeMenu === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveMenu(tab.id)
                    if (tab.id === "pinned") {
                      setSelectedCategories([])
                      setSearchQuery("")
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium sm:text-sm",
                    isActive
                      ? "bg-[var(--cc-accent)] text-white"
                      : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                  )}
                >
                  {tab.id === "pinned" ? <Pin className="h-3.5 w-3.5" /> : null}
                  {tab.label}
                  {tab.id === "pinned" && stats.pinned > 0 ? (
                    <span className="tabular-nums opacity-80">{stats.pinned}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
              <FacultyIntegratedToolbar
                embedded={embedInDashboard}
                moduleId="announcements"
                search={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by title, body, or author…"
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                filters={
                  <>
                    {categories.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={facultyToolbarFilterButtonClass(selectedCategories.length > 0)}
                          >
                            <Filter className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span className="hidden sm:inline">Category</span>
                            {selectedCategories.length > 0 ? (
                              <span className="ml-0.5 rounded-md bg-[var(--sidebar-accent)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                                {selectedCategories.length}
                              </span>
                            ) : null}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                          {categories.map((category) => (
                            <DropdownMenuCheckboxItem
                              key={category}
                              checked={selectedCategories.includes(category!)}
                              onCheckedChange={(checked) =>
                                setSelectedCategories((prev) =>
                                  checked ? [...prev, category!] : prev.filter((c) => c !== category),
                                )
                              }
                            >
                              {category}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()}>
                          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                          <span className="sm:hidden">Sort</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={sortBy}
                          onValueChange={(v) => setSortBy(v as typeof sortBy)}
                        >
                          <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="mostViewed">Most viewed</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
                meta={
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-[var(--cc-text-muted)]">
                      {filteredAnnouncements.length === stats.total ? (
                        <>
                          <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">{stats.total}</span>
                          {" "}announcement{stats.total === 1 ? "" : "s"}
                          {stats.pinned > 0 ? (
                            <>
                              {" "}·{" "}
                              <span className="tabular-nums">{stats.pinned}</span> pinned
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          Showing{" "}
                          <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">
                            {filteredAnnouncements.length}
                          </span>
                          {" "}of{" "}
                          <span className="tabular-nums">{stats.total}</span>
                        </>
                      )}
                      {activeMenu === "pinned" ? " · pinned only" : null}
                    </p>
                    {(searchQuery || selectedCategories.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 px-2 text-xs text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                }
                chips={
                  selectedCategories.length > 0 ? (
                    <>
                      {selectedCategories.map((category) => (
                        <Badge
                          key={category}
                          variant="secondary"
                          className={cn("h-6 gap-1 rounded-md pl-2 pr-1 text-xs font-normal", fp.softBg, fp.iconText)}
                        >
                          {category}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCategories((prev) => prev.filter((c) => c !== category))
                            }
                            className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                            aria-label={`Remove ${category} filter`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </>
                  ) : undefined
                }
                trailing={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={() => fetchAnnouncements()}
                      className={facultyToolbarFilterButtonClass()}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5 shrink-0 opacity-70", loading && "animate-spin")} />
                      <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                      className={cn("h-9 gap-2 rounded-lg", fp.cta)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Create</span>
                    </Button>
                  </>
                }
              />

            {/* Announcements List */}
            <div className={cn(viewMode === "grid" ? "grid grid-cols-1 gap-4 auto-rows-fr md:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3")}>
              <AnimatePresence mode="popLayout">
                {filteredAnnouncements.length === 0 ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                    <div className={cn(cardBase, "border-dashed py-14 text-center")}>
                      <Megaphone className={cn("mx-auto mb-3 h-10 w-10", PORTAL_TEXT_MUTED)} />
                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                        {activeMenu === "pinned" ? "No pinned announcements" : "No announcements yet"}
                      </p>
                      <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                        {activeMenu === "pinned"
                          ? "Pin an announcement to see it here"
                          : "Use Create in the toolbar to publish your first update"}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  filteredAnnouncements.map((announcement, index) => (
                    <motion.div key={announcement.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ delay: index * 0.03 }} className={viewMode === 'grid' ? "h-full" : ""}>
                      <AnnouncementCardRedesign
                        announcement={{ ...announcement, is_read: true, category: announcement.category || 'General' }}
                        variant="instructor"
                        displayMode={viewMode}
                        onView={() => handleViewDetails(announcement.id)}
                        onReact={() => {}}
                        onEdit={() => handleEdit(announcement)}
                        onDelete={() => handleDelete(announcement)}
                        onPin={() => handlePin(announcement)}
                        onLock={() => handleLock(announcement)}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
        </div>

        {/* Modals */}
        {selectedAnnouncement && (
          <AnnouncementDetailModal
            announcement={{ ...selectedAnnouncement, allow_reactions: selectedAnnouncement.allow_reactions ?? true, allow_comments: selectedAnnouncement.allow_comments ?? true }}
            instructorId={instructorId}
            viewerMode="instructor"
            isOpen={viewModalOpen}
            onClose={() => { setViewModalOpen(false); setSelectedAnnouncement(null) }}
          />
        )}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent
            className="!max-w-[60rem] w-[min(60rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
              <DialogDescription>Share important updates with all students</DialogDescription>
            </DialogHeader>
            <AnnouncementForm instructorId={instructorId} courseId={courseId} onSuccess={() => { setCreateDialogOpen(false); setActiveMenu("overview"); fetchAnnouncements() }} onCancel={() => { setCreateDialogOpen(false); setActiveMenu("overview") }} />
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent
            className="!max-w-[60rem] w-[min(60rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
              <DialogDescription>Update your announcement details</DialogDescription>
            </DialogHeader>
            {selectedAnnouncement && (
              <AnnouncementForm instructorId={instructorId} courseId={courseId} initialData={{ id: selectedAnnouncement.id, title: selectedAnnouncement.title, content: selectedAnnouncement.content, pinned: selectedAnnouncement.pinned, allow_reactions: selectedAnnouncement.allow_reactions, allow_comments: selectedAnnouncement.allow_comments, student_content_locked: selectedAnnouncement.student_content_locked ?? false, ai_summary: selectedAnnouncement.ai_summary ?? null, attachments: selectedAnnouncement.attachments || [] }} onSuccess={() => { setEditDialogOpen(false); setSelectedAnnouncement(null); fetchAnnouncements() }} onCancel={() => { setEditDialogOpen(false); setSelectedAnnouncement(null) }} />
            )}
          </DialogContent>
        </Dialog>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete "{selectedAnnouncement?.title}". This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
    </>
  )
}

export default function InstructorAnnouncementsPage() {
  return <InstructorAnnouncementsContent />
}

