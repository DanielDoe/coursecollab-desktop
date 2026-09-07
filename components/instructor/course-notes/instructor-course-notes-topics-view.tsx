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
  FACULTY_CONTENT_PAGE_SIZE,
  FacultySidebarPagination,
  pageForContentIndex,
} from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { InstructorCourseNoteEditor } from "@/components/instructor/course-notes/instructor-course-note-editor"
import {
  CourseNoteTopicCard,
  CourseNoteTopicNoteRow,
} from "@/components/instructor/course-notes/course-note-topic-card"
import { useInstructorFlashcardSessions } from "@/components/instructor/flashcards/use-instructor-flashcard-sessions"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"

const MODULE_ID = "course-notes"

type CourseNoteTopic = {
  name: string
  note_count: number
}

type Props = {
  notes: CourseDigitalNote[]
  onReload: () => Promise<void>
}

export function InstructorCourseNotesTopicsView({ notes, onReload }: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const scopeKey = useInstructorScopeKey()
  const { sessions } = useInstructorFlashcardSessions()
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<CourseNoteTopic[]>([])
  const [session, setSession] = useState("SCOPED")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [listPage, setListPage] = useState(1)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const url =
        session === "SCOPED"
          ? "/api/instructor/course-notes/topics"
          : `/api/instructor/course-notes/topics?session=${encodeURIComponent(session)}`
      const res = await fetch(url, { headers: headers() })
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

  const topicNotes = useMemo(() => {
    if (!selectedTopic) return []
    const term = search.trim().toLowerCase()
    return notes
      .filter((n) => {
        if ((n.topic?.trim() || "General") !== selectedTopic) return false
        if (!term) return true
        return n.title.toLowerCase().includes(term)
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [notes, selectedTopic, search])

  const totalListPages = Math.max(1, Math.ceil(topicNotes.length / FACULTY_CONTENT_PAGE_SIZE))
  const pageNotes = useMemo(() => {
    const start = (listPage - 1) * FACULTY_CONTENT_PAGE_SIZE
    return topicNotes.slice(start, start + FACULTY_CONTENT_PAGE_SIZE)
  }, [topicNotes, listPage])

  const selectedIndex = useMemo(
    () => (selectedNoteId ? topicNotes.findIndex((note) => note.id === selectedNoteId) : -1),
    [topicNotes, selectedNoteId],
  )

  useEffect(() => {
    setListPage(1)
  }, [selectedTopic, search])

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages)
  }, [listPage, totalListPages])

  useEffect(() => {
    if (selectedIndex >= 0) setListPage(pageForContentIndex(selectedIndex))
  }, [selectedIndex])

  const goToPreviousNote = useCallback(() => {
    if (selectedIndex > 0) setSelectedNoteId(topicNotes[selectedIndex - 1]!.id)
  }, [selectedIndex, topicNotes])

  const goToNextNote = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < topicNotes.length - 1) {
      setSelectedNoteId(topicNotes[selectedIndex + 1]!.id)
    }
  }, [selectedIndex, topicNotes])

  const openTopic = (name: string) => {
    setSelectedTopic(name)
    setSelectedNoteId(null)
  }

  const topicNames = useMemo(() => topics.map((t) => t.name), [topics])

  if (selectedTopic && selectedNoteId) {
    return (
      <div className="space-y-3 min-w-0">
        <button
          type="button"
          onClick={() => setSelectedNoteId(null)}
          className={cn("inline-flex items-center gap-1.5 text-sm font-medium", chrome.p.iconText)}
        >
          <ArrowLeft className="h-4 w-4" />
          {selectedTopic}
        </button>
        <InstructorCourseNoteEditor
          noteId={selectedNoteId}
          topicNames={topicNames}
          onReload={onReload}
          onDeleted={() => setSelectedNoteId(null)}
          showCreatePrompt={false}
          navigation={
            topicNotes.length > 1
              ? {
                  currentIndex: selectedIndex,
                  total: topicNotes.length,
                  onPrevious: goToPreviousNote,
                  onNext: goToNextNote,
                }
              : undefined
          }
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
        searchPlaceholder={selectedTopic ? "Search notes in topic…" : "Search topics…"}
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
                  setSelectedNoteId(null)
                }}
                className="inline-flex items-center gap-1 text-xs text-[var(--cc-accent)] hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                All topics
              </button>
            ) : null}
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {selectedTopic
                ? `${topicNotes.length} note${topicNotes.length === 1 ? "" : "s"} in ${selectedTopic}`
                : `${filteredTopics.length} topic${filteredTopics.length === 1 ? "" : "s"}`}
            </span>
          </div>
        }
      />

      {!selectedTopic ? (
        filteredTopics.length === 0 ? (
          <div className={cn(PORTAL_CARD, "px-4 py-10 text-center")}>
            <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No topics yet. Create a note under All Notes and assign a topic.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {filteredTopics.map((topic) => (
              <CourseNoteTopicCard
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
              <CourseNoteTopicCard
                key={topic.name}
                topic={topic}
                viewMode="grid"
                onOpen={() => openTopic(topic.name)}
              />
            ))}
          </div>
        )
      ) : (
        <section className={cn(PORTAL_CARD, "p-4 space-y-3")}>
          {topicNotes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No notes in this topic. Add one from All Notes.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {pageNotes.map((note) => (
                  <CourseNoteTopicNoteRow
                    key={note.id}
                    title={displayContentTitle(note.title)}
                    isPublished={note.isPublished}
                    selected={false}
                    onSelect={() => setSelectedNoteId(note.id)}
                  />
                ))}
              </div>
              <FacultySidebarPagination
                page={listPage}
                totalPages={totalListPages}
                totalItems={topicNotes.length}
                pageSize={FACULTY_CONTENT_PAGE_SIZE}
                onPageChange={setListPage}
              />
            </>
          )}
        </section>
      )}
    </div>
  )
}
