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
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { InstructorCourseNoteEditor } from "@/components/instructor/course-notes/instructor-course-note-editor"
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
import {
  CourseNoteCard,
  CourseNoteList,
  COURSE_NOTE_PAGE_SIZE,
} from "@/components/instructor/course-notes/course-note-card"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { FilePenLine, Plus, X, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { toast } from "@/lib/app-toast"

const MODULE_ID = "course-notes"

type Props = {
  notes: CourseDigitalNote[]
  selectedNoteId: number | null
  topicFilter: string | null
  onSelectNote: (id: number | null) => void
  onClearTopicFilter: () => void
  onReload: () => Promise<void>
  nativeLayout?: boolean
}

export function InstructorCourseNotesAllView({
  notes,
  selectedNoteId,
  topicFilter,
  onSelectNote,
  onClearTopicFilter,
  onReload,
  nativeLayout = false,
}: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const { sessions } = useInstructorFlashcardSessions()
  const [search, setSearch] = useState("")
  const [topicSelect, setTopicSelect] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [topicNames, setTopicNames] = useState<string[]>([])
  const [listPage, setListPage] = useState(1)
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [nativeScreen, setNativeScreen] = useState<"list" | "edit">("list")

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  useEffect(() => {
    void (async () => {
      try {
        const res = await instructorApiFetch("/api/instructor/course-notes/topics?session=ALL", { headers: headers() })
        const data = await res.json()
        if (res.ok) {
          setTopicNames((data.topics || []).map((t: { name: string }) => t.name))
        }
      } catch {
        /* optional */
      }
    })()
  }, [])

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return notes.filter((note) => {
      const noteTopic = note.topic?.trim() || "General"
      if (topicFilter && noteTopic !== topicFilter) return false
      if (topicSelect !== "all" && noteTopic !== topicSelect) return false
      if (statusFilter === "published" && !note.isPublished) return false
      if (statusFilter === "draft" && note.isPublished) return false
      if (!term) return true
      return (
        note.title.toLowerCase().includes(term) ||
        noteTopic.toLowerCase().includes(term) ||
        (note.bodyText ?? "").toLowerCase().includes(term)
      )
    })
  }, [notes, search, topicFilter, topicSelect, statusFilter])

  const orderedNotes = useMemo(() => orderContentByTopic(filteredNotes), [filteredNotes])

  const totalListPages = Math.max(1, Math.ceil(orderedNotes.length / COURSE_NOTE_PAGE_SIZE))
  const pageNotes = useMemo(() => {
    const start = (listPage - 1) * COURSE_NOTE_PAGE_SIZE
    return orderedNotes.slice(start, start + COURSE_NOTE_PAGE_SIZE)
  }, [orderedNotes, listPage])

  const selectedIndex = useMemo(
    () => (selectedNoteId ? orderedNotes.findIndex((note) => note.id === selectedNoteId) : -1),
    [orderedNotes, selectedNoteId],
  )

  useEffect(() => {
    setListPage(1)
  }, [search, topicSelect, statusFilter, topicFilter])

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages)
  }, [listPage, totalListPages])

  useEffect(() => {
    if (selectedIndex >= 0) {
      setListPage(pageForContentIndex(selectedIndex))
    }
  }, [selectedIndex])

  const goToPreviousNote = useCallback(() => {
    if (selectedIndex > 0) onSelectNote(orderedNotes[selectedIndex - 1]!.id)
  }, [orderedNotes, onSelectNote, selectedIndex])

  const goToNextNote = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < orderedNotes.length - 1) {
      onSelectNote(orderedNotes[selectedIndex + 1]!.id)
    }
  }, [orderedNotes, onSelectNote, selectedIndex])

  const createNote = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: "New course note",
          topic:
            topicFilter && topicFilter !== "General"
              ? topicFilter
              : topicSelect !== "all" && topicSelect !== "General"
                ? topicSelect
                : null,
          isPublished: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      await onReload()
      onSelectNote(data.note.id)
    } catch (err: unknown) {
      toast.error("Create failed", { description: err instanceof Error ? err.message : undefined })
    }
  }, [onReload, onSelectNote, topicFilter, topicSelect])

  useEffect(() => {
    if (!nativeLayout) return
    if (selectedNoteId != null) setNativeScreen("edit")
  }, [nativeLayout, selectedNoteId])

  const selectNoteNative = (id: number) => {
    onSelectNote(id)
    if (nativeLayout) setNativeScreen("edit")
  }

  const topicOptions = useMemo(() => {
    const names = new Set<string>()
    for (const note of notes) names.add(note.topic?.trim() || "General")
    return [...names].sort()
  }, [notes])

  if (nativeLayout && nativeScreen === "edit" && selectedNoteId) {
    return (
      <div className="space-y-3 min-w-0">
        <button
          type="button"
          data-notes-native-stack-back
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)]"
          onClick={() => {
            setNativeScreen("list")
            onSelectNote(null)
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          All notes
        </button>
        <InstructorCourseNoteEditor
          noteId={selectedNoteId}
          topicNames={topicNames}
          onReload={onReload}
          onDeleted={() => {
            onSelectNote(null)
            setNativeScreen("list")
          }}
          onCreateNote={() => void createNote()}
          navigation={
            orderedNotes.length > 1
              ? {
                  currentIndex: selectedIndex,
                  total: orderedNotes.length,
                  onPrevious: goToPreviousNote,
                  onNext: goToNextNote,
                }
              : undefined
          }
        />
      </div>
    )
  }

  if (nativeLayout) {
    return (
      <div className="space-y-3 min-w-0">
        <div className="cc-native-search-row">
          <Search className="cc-native-search-icon" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search course notes…"
            className="cc-native-search-input"
          />
        </div>
        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Notes · {filteredNotes.length}</h2>
          <div className="cc-native-group">
            {filteredNotes.length === 0 ? (
              <p className="cc-native-empty">No notes match your filters.</p>
            ) : (
              <ul className="cc-native-list">
                {orderedNotes.map((note, index) => (
                  <li
                    key={note.id}
                    className={cn(
                      "cc-native-note-item",
                      index === orderedNotes.length - 1 && "cc-native-note-item-last",
                    )}
                  >
                    <button
                      type="button"
                      className="cc-native-row cc-native-note-link cc-native-row-last"
                      onClick={() => selectNoteNative(note.id)}
                    >
                      <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                        <FilePenLine className="h-4 w-4" />
                      </span>
                      <span className="cc-native-row-copy">
                        <span className="cc-native-row-title truncate">{displayContentTitle(note.title)}</span>
                        <span className="cc-native-row-subtitle truncate">
                          {note.topic?.trim() || "General"} · {note.isPublished ? "Live" : "Draft"}
                        </span>
                      </span>
                      <ChevronRight className="cc-native-row-chevron" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <Button
          size="sm"
          className={cn("w-full gap-1.5 rounded-xl", chrome.cta)}
          onClick={() => void createNote()}
        >
          <Plus className="h-4 w-4" />
          New note
        </Button>
      </div>
    )
  }

  if (selectedNoteId) {
    return (
      <div className="space-y-3 min-w-0">
        <button
          type="button"
          onClick={() => onSelectNote(null)}
          className={cn("inline-flex items-center gap-1.5 text-sm font-medium", chrome.p.iconText)}
        >
          <ChevronLeft className="h-4 w-4" />
          All notes
        </button>
        <InstructorCourseNoteEditor
          noteId={selectedNoteId}
          topicNames={topicNames}
          onReload={onReload}
          onDeleted={() => onSelectNote(null)}
          onCreateNote={() => void createNote()}
          navigation={
            orderedNotes.length > 1
              ? {
                  currentIndex: selectedIndex,
                  total: orderedNotes.length,
                  onPrevious: goToPreviousNote,
                  onNext: goToNextNote,
                }
              : undefined
          }
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
        searchPlaceholder="Search notes…"
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
          <Button size="sm" className={cn("h-9 shrink-0 gap-1.5", chrome.cta)} onClick={() => void createNote()}>
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">New note</span>
          </Button>
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {formatContentCount(filteredNotes.length, "note")}
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
          {filteredNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-10 text-center">
              <FilePenLine className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No notes match your filters.</p>
              <Button size="sm" className={cn("mt-4", chrome.cta)} onClick={() => void createNote()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New note
              </Button>
            </div>
          ) : (
            <>
              <CourseNoteList
                notes={pageNotes}
                selectedNoteId={selectedNoteId}
                onSelectNote={onSelectNote}
              />
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={orderedNotes.length}
                pageSize={COURSE_NOTE_PAGE_SIZE}
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
          {filteredNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-10 text-center">
              <FilePenLine className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No notes match your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pageNotes.map((note) => (
                  <CourseNoteCard
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    topic={note.topic}
                    bodyText={note.bodyText}
                    isPublished={note.isPublished}
                    session={note.session}
                    updatedAt={note.updatedAt}
                    selected={selectedNoteId === note.id}
                    onSelect={() => onSelectNote(note.id)}
                  />
                ))}
              </div>
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={orderedNotes.length}
                pageSize={COURSE_NOTE_PAGE_SIZE}
                onPageChange={setListPage}
              />
            </>
          )}
        </section>
      )}
    </div>
  )
}
