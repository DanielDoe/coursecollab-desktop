"use client"

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react"
import {
  BookOpen,
  ChevronRight,
  Loader2,
  NotebookPen,
  Plus,
  Search,
  Share2,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { useNotesChrome } from "@/hooks/use-notes-chrome"
import { notesListThumbFor } from "@/lib/notes-list-theme"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import type { StudentDigitalNote } from "@/lib/student-digital-notes"
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { useStudentNotesQuery } from "@/hooks/data/use-student-notes-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import { noteContentPreviewText } from "@/lib/digital-note-content"
import { cn } from "@/lib/utils"
import { StudentDigitalNotesPanel } from "@/components/student/digital-notes/student-digital-notes-panel"
import { StudentCourseNotesPanel } from "@/components/student/digital-notes/student-course-notes-panel"
import {
  CreateNoteDialog,
  type CreateNoteDraft,
} from "@/components/student/digital-notes/create-note-dialog"
import { toast } from "@/lib/app-toast"

type NoteSelection =
  | { kind: "mine"; id: number }
  | { kind: "course"; id: number }
  | null

type BrowseFilter = "all" | "mine" | "shared" | "course"
type NoteSort = "recent" | "title"
type ContentFilter = "all" | "typed" | "ink" | "both"

type Props = {
  nativeLayout?: boolean
  initialNoteId?: number | null
}

function forwardWheelToMain(event: WheelEvent<HTMLElement>) {
  const main = event.currentTarget.closest("main")
  if (!main || main.scrollHeight <= main.clientHeight + 1) return

  const nested = (event.target as HTMLElement | null)?.closest("[data-notes-scroll]")
  if (nested instanceof HTMLElement) {
    const canScroll = nested.scrollHeight > nested.clientHeight + 1
    const atTop = nested.scrollTop <= 0 && event.deltaY < 0
    const atBottom =
      nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 1 && event.deltaY > 0
    if (canScroll && !atTop && !atBottom) return
  }

  main.scrollTop += event.deltaY
  event.preventDefault()
}

function SidebarDivider({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </li>
  )
}

export function StudentNotesHub({ nativeLayout = false, initialNoteId = null }: Props) {
  const chrome = useNotesChrome()
  const { roles: ROLES } = chrome
  const deepLinkNoteId =
    initialNoteId != null && Number.isFinite(initialNoteId) && initialNoteId > 0
      ? initialNoteId
      : null

  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>("all")
  const [sort, setSort] = useState<NoteSort>("recent")
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all")
  const [selection, setSelection] = useState<NoteSelection>(null)
  const [nativeStacked, setNativeStacked] = useState(false)
  const {
    myNotes,
    courseNotes,
    isLoading: loading,
    refreshFailed,
    refetch,
    createNote,
    setMyNotes,
  } = useStudentNotesQuery()
  const creating = createNote.isPending

  useEffect(() => {
    setSelection((prev) => {
      if (prev) return prev
      if (deepLinkNoteId != null && myNotes.some((note) => note.id === deepLinkNoteId)) {
        return { kind: "mine", id: deepLinkNoteId }
      }
      if (myNotes.length > 0) return { kind: "mine", id: myNotes[0].id }
      if (courseNotes.length > 0) return { kind: "course", id: courseNotes[0].id }
      return null
    })
  }, [deepLinkNoteId, myNotes, courseNotes])

  useEffect(() => {
    if (deepLinkNoteId != null && myNotes.some((note) => note.id === deepLinkNoteId)) {
      setSelection({ kind: "mine", id: deepLinkNoteId })
      if (nativeLayout) setNativeStacked(true)
    }
  }, [deepLinkNoteId, myNotes, nativeLayout])

  const query = search.trim().toLowerCase()

  const mineCount = myNotes.filter((note) => note.isOwner !== false).length
  const sharedCount = myNotes.filter((note) => note.isOwner === false).length
  const courseCount = courseNotes.length
  const totalCount = myNotes.length + courseCount

  const browseCounts: Record<BrowseFilter, number> = {
    all: totalCount,
    mine: mineCount,
    shared: sharedCount,
    course: courseCount,
  }

  const activeToolbarFilters =
    (sort !== "recent" ? 1 : 0) + (contentFilter !== "all" ? 1 : 0)

  const filteredMine = useMemo(() => {
    if (browseFilter === "course") return []

    let next = myNotes.filter((note) => {
      if (browseFilter === "mine" && note.isOwner === false) return false
      if (browseFilter === "shared" && note.isOwner !== false) return false

      const hasTyped = note.bodyText.trim().length > 0
      const hasInk = workspaceHasContent(note.inkWorkspace)
      if (contentFilter === "typed" && !hasTyped) return false
      if (contentFilter === "ink" && !hasInk) return false
      if (contentFilter === "both" && !(hasTyped && hasInk)) return false

      if (!query) return true
      return (
        note.title.toLowerCase().includes(query) ||
        note.bodyText.toLowerCase().includes(query) ||
        (note.ownerName?.toLowerCase().includes(query) ?? false)
      )
    })

    next = [...next].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return next
  }, [myNotes, browseFilter, contentFilter, query, sort])

  const filteredCourse = useMemo(() => {
    if (browseFilter === "mine" || browseFilter === "shared") return []

    let next = courseNotes
    if (browseFilter === "course" || browseFilter === "all") {
      if (query) {
        next = next.filter(
          (note) =>
            note.title.toLowerCase().includes(query) ||
            note.bodyText.toLowerCase().includes(query) ||
            (note.topic?.toLowerCase().includes(query) ?? false),
        )
      }
      next = [...next].sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
    }
    return next
  }, [courseNotes, browseFilter, query, sort])

  const openMine = (id: number) => {
    setSelection({ kind: "mine", id })
    if (nativeLayout) setNativeStacked(true)
  }

  const openCourse = (id: number) => {
    setSelection({ kind: "course", id })
    if (nativeLayout) setNativeStacked(true)
  }

  const handleCreateNote = async (draft: CreateNoteDraft) => {
    try {
      const created = await createNote.mutateAsync(draft)
      setSelection({ kind: "mine", id: created.id })
      setBrowseFilter("mine")
      setCreateOpen(false)
      if (nativeLayout) setNativeStacked(true)
    } catch (err: unknown) {
      toast.error("Could not create note", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const syncMyNotes = useCallback(
    (next: StudentDigitalNote[]) => {
      setMyNotes(next)
      if (
        selection?.kind === "mine" &&
        !next.some((note) => note.id === selection.id)
      ) {
        if (next[0]) setSelection({ kind: "mine", id: next[0].id })
        else if (courseNotes[0]) setSelection({ kind: "course", id: courseNotes[0].id })
        else setSelection(null)
      }
    },
    [selection, courseNotes],
  )

  const isSelected = (kind: "mine" | "course", id: number) =>
    selection?.kind === kind && selection.id === id

  const listEmpty = filteredMine.length === 0 && filteredCourse.length === 0
  const showCourseDivider = browseFilter === "all" && filteredMine.length > 0 && filteredCourse.length > 0

  const renderNoteList = (variant: "web" | "native") => {
    if (listEmpty) {
      return (
        <div className={cn(variant === "native" ? "cc-native-empty-block" : "px-3 py-8 text-center")}>
          {variant === "native" ? (
            <span className="cc-native-icon-tile cc-native-icon-tile-accent cc-native-empty-icon">
              <NotebookPen className="h-5 w-5" />
            </span>
          ) : (
            <NotebookPen className="mx-auto h-8 w-8" style={{ color: ROLES.create.fill }} />
          )}
          <p
            className={cn(
              variant === "native"
                ? "cc-native-empty-title"
                : "mt-2 text-sm font-medium text-[var(--cc-text)]",
            )}
          >
            {totalCount === 0 ? "No notes yet" : "No matches"}
          </p>
          <p
            className={cn(
              variant === "native"
                ? "cc-native-empty-body"
                : "mt-1 text-xs text-[var(--cc-text-muted)]",
            )}
          >
            {totalCount === 0
              ? "Create a note or wait for instructor materials."
              : "Try another search or filter."}
          </p>
        </div>
      )
    }

    const webItemClass = (selected: boolean) =>
      cn(
        "flex h-[88px] w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))] bg-[var(--cc-accent-soft)]"
          : "hover:bg-[var(--muted)]/30",
      )

    return (
      <ul className={cn(variant === "native" ? "cc-native-list" : "flex flex-col gap-2")}>
        {filteredMine.map((note, index) => {
          const selected = isSelected("mine", note.id)
          const hasInk = workspaceHasContent(note.inkWorkspace)
          return (
            <li
              key={`mine-${note.id}`}
              className={cn(
                variant === "native" && "cc-native-note-item",
                variant === "native" &&
                  index === filteredMine.length - 1 &&
                  filteredCourse.length === 0 &&
                  "cc-native-note-item-last",
              )}
            >
              <button
                type="button"
                onClick={() => openMine(note.id)}
                className={
                  variant === "native"
                    ? "cc-native-row cc-native-note-link cc-native-row-last w-full"
                    : webItemClass(selected)
                }
              >
                {variant === "native" ? (
                  <>
                    <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                      {note.isOwner === false ? (
                        <Share2 className="h-4 w-4" />
                      ) : (
                        <NotebookPen className="h-4 w-4" />
                      )}
                    </span>
                    <span className="cc-native-row-copy min-w-0 flex-1">
                      <span className="cc-native-row-title block truncate">{note.title}</span>
                      <span className="cc-native-row-subtitle block truncate">
                        {note.isOwner === false && note.ownerName
                          ? `Shared · ${note.ownerName}`
                          : note.bodyText.trim()
                            ? noteContentPreviewText(note.bodyText, 64)
                            : hasInk
                              ? "Handwritten"
                              : "Empty note"}
                      </span>
                    </span>
                    <ChevronRight className="cc-native-row-chevron" aria-hidden />
                  </>
                ) : (
                  <>
                    <SolidListThumbTile
                      thumb={notesListThumbFor(chrome, {
                        index,
                        kind: note.isOwner === false ? "shared" : "mine",
                        hasTyped: Boolean(note.bodyText?.trim()),
                        hasInk,
                        iconColor: note.iconColor,
                      })}
                      icon={note.isOwner === false ? Share2 : NotebookPen}
                    />
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{note.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--cc-text-muted)]">
                        {note.isOwner === false && note.ownerName
                          ? `Shared by ${note.ownerName}`
                          : note.bodyText.trim()
                            ? noteContentPreviewText(note.bodyText, 72)
                            : hasInk
                              ? "Handwritten note"
                              : "Empty note"}
                      </p>
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}

        {showCourseDivider ? <SidebarDivider label="From instructor" /> : null}

        {filteredCourse.map((note, index) => {
          const selected = isSelected("course", note.id)
          const hasInk = note.inkWorkspace != null && workspaceHasContent(note.inkWorkspace)
          return (
            <li
              key={`course-${note.id}`}
              className={cn(
                variant === "native" && "cc-native-note-item",
                variant === "native" &&
                  index === filteredCourse.length - 1 &&
                  "cc-native-note-item-last",
              )}
            >
              <button
                type="button"
                onClick={() => openCourse(note.id)}
                className={
                  variant === "native"
                    ? "cc-native-row cc-native-note-link cc-native-row-last w-full"
                    : webItemClass(selected)
                }
              >
                {variant === "native" ? (
                  <>
                    <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="cc-native-row-copy min-w-0 flex-1">
                      <span className="cc-native-row-title block truncate">{note.title}</span>
                      <span className="cc-native-row-subtitle block truncate">
                        {note.topic || "Course material"}
                        {hasInk ? " · Ink" : ""}
                      </span>
                    </span>
                    <ChevronRight className="cc-native-row-chevron" aria-hidden />
                  </>
                ) : (
                  <>
                    <SolidListThumbTile
                      thumb={notesListThumbFor(chrome, {
                        index,
                        kind: "course",
                        hasTyped: Boolean(note.bodyText?.trim()),
                        hasInk,
                      })}
                      icon={BookOpen}
                    />
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{note.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--cc-text-muted)]">
                        {note.topic || "Course material"}
                        {hasInk ? " · Handwritten" : ""}
                      </p>
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const browseMenuItems = [
    { id: "all" as const, label: "All notes", icon: NotebookPen, badge: browseCounts.all },
    { id: "mine" as const, label: "Mine", icon: UserRound, badge: browseCounts.mine },
    { id: "shared" as const, label: "Shared", icon: Share2, badge: browseCounts.shared },
    { id: "course" as const, label: "Course", icon: BookOpen, badge: browseCounts.course },
  ]

  const createDialog = (
    <CreateNoteDialog
      open={createOpen}
      creating={creating}
      onOpenChange={setCreateOpen}
      onSubmit={handleCreateNote}
    />
  )

  const detailPane =
    selection?.kind === "course" ? (
      <StudentCourseNotesPanel
        nativeLayout={nativeLayout}
        layout="detail"
        controlledActiveId={selection.id}
        notesOverride={courseNotes}
        onNativeStackChange={(stacked) => {
          if (!stacked) {
            setNativeStacked(false)
            setSelection(null)
          }
        }}
      />
    ) : (
      <StudentDigitalNotesPanel
        nativeLayout={nativeLayout}
        layout="detail"
        controlledActiveId={selection?.kind === "mine" ? selection.id : null}
        sharedSearch={search}
        notesOverride={myNotes}
        onNotesChange={syncMyNotes}
        onNativeStackChange={(stacked) => {
          if (!stacked) {
            setNativeStacked(false)
            setSelection(null)
          }
        }}
      />
    )

  if (loading) {
    return <ModuleListSkeleton rows={7} className="min-h-[50vh] p-1" />
  }

  if (nativeLayout && nativeStacked) {
    return (
      <div data-student-notes-native-root className="cc-native-notetaker">
        {detailPane}
      </div>
    )
  }

  if (nativeLayout) {
    return (
      <div data-student-notes-native-root className="cc-native-notetaker space-y-3">
        <div className="cc-native-search-row">
          <Search className="cc-native-search-icon" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes…"
            className="cc-native-search-input"
          />
        </div>

        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Browse</h2>
          <div className="cc-native-group">
            {browseMenuItems.map((item, index, arr) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "cc-native-row",
                  index === arr.length - 1 && "cc-native-row-last",
                  browseFilter === item.id && "bg-[var(--sidebar-accent)]/35",
                )}
                onClick={() => setBrowseFilter(item.id)}
              >
                <span className="cc-native-row-copy">
                  <span className="cc-native-row-title">{item.label}</span>
                  <span className="cc-native-row-subtitle">{item.badge} notes</span>
                </span>
                {browseFilter === item.id ? (
                  <span className="cc-native-status-pill">Active</span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Notes</h2>
          <div className="cc-native-group">{renderNoteList("native")}</div>
        </section>

        <Button
          type="button"
          className="h-12 w-full gap-2 rounded-xl bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
          onClick={() => setCreateOpen(true)}
          disabled={creating}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New note
        </Button>
        {createDialog}
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" onWheel={forwardWheelToMain}>
      <StaleRefreshHint visible={refreshFailed} onRetry={() => void refetch()} />
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Notes
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
              {filteredMine.length + filteredCourse.length} shown
              <span className="text-[var(--cc-text-muted)]">
                {" "}
                · {mineCount} mine · {sharedCount} shared · {courseCount} course
                {activeToolbarFilters > 0 ? ` · ${activeToolbarFilters} filters` : ""}
              </span>
            </p>
          </div>
          <Button
            type="button"
            className="h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
            style={{ backgroundColor: ROLES.create.fill, color: ROLES.create.icon }}
            onClick={() => setCreateOpen(true)}
            disabled={creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">New note</span>
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="relative h-10 min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes…"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 pl-10 pr-3 text-sm text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] outline-none focus:border-[var(--cc-accent)]/40"
            />
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
            <SelectTrigger className="h-10 w-[7.25rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={contentFilter}
            onValueChange={(value) => setContentFilter(value as ContentFilter)}
          >
            <SelectTrigger className="hidden h-10 w-[8rem] shrink-0 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 sm:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All content</SelectItem>
              <SelectItem value="typed">Typed only</SelectItem>
              <SelectItem value="ink">Handwritten</SelectItem>
              <SelectItem value="both">Typed + ink</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {browseMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBrowseFilter(item.id)}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={
                browseFilter === item.id
                  ? { backgroundColor: "var(--cc-accent-soft)", color: "var(--cc-text)" }
                  : { backgroundColor: "var(--muted)", color: "var(--cc-text-muted)" }
              }
            >
              {item.label} {item.badge}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:h-[calc(10*88px+9*8px)] lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <div
          data-notes-scroll
          className="max-h-[calc(10*88px+9*8px)] overflow-y-auto pr-0.5 lg:h-full lg:max-h-none"
        >
          {renderNoteList("web")}
        </div>
        <div className="flex h-[calc(10*88px+9*8px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 lg:h-full">
          {detailPane}
        </div>
      </div>
      {createDialog}
    </div>
  )
}
