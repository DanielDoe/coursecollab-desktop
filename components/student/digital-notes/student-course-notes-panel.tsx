"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CircuitWorkspaceEditor } from "@/components/circuit-workspace-editor"
import { DigitalNoteEditor } from "@/components/student/digital-notes/digital-note-editor"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { createEmptyWorkspace, workspaceHasContent } from "@/lib/circuit-workspace"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-toast"

type Props = {
  nativeLayout?: boolean
  onNativeStackChange?: (stacked: boolean) => void
  /** Hub mode: only render the reader for the controlled note. */
  layout?: "full" | "detail"
  controlledActiveId?: number | null
  /** Pre-loaded notes (hub owns fetch). */
  notesOverride?: CourseDigitalNote[]
}

type ContentTab = "typed" | "ink"

export function CourseNoteReader({ note }: { note: CourseDigitalNote }) {
  const inkWorkspace = note.inkWorkspace ?? createEmptyWorkspace()
  const hasInk = workspaceHasContent(inkWorkspace)
  const defaultTab: ContentTab = hasInk && !note.bodyText.trim() ? "ink" : "typed"
  const [contentTab, setContentTab] = useState<ContentTab>(defaultTab)

  useEffect(() => {
    setContentTab(hasInk && !note.bodyText.trim() ? "ink" : "typed")
  }, [note.id, hasInk, note.bodyText])

  useEffect(() => {
    if (!note.bodyText.trim() && !hasInk) return
    studentApiFetch("/api/student/course-notes/view", {
      method: "POST",
      headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: note.id }),
    }).catch(() => undefined)
  }, [note.id, note.bodyText, hasInk])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-[var(--cc-text)] sm:text-xl">{note.title}</h2>
        {note.topic ? (
          <Badge
            variant="outline"
            className="mt-2 border-[var(--cc-accent-border)] text-[var(--cc-accent-dark)]"
          >
            {note.topic}
          </Badge>
        ) : hasInk ? (
          <Badge variant="outline" className="mt-2 border-[var(--border)] text-[var(--cc-text-muted)]">
            Has ink
          </Badge>
        ) : null}
      </div>

      <Tabs
        value={contentTab}
        onValueChange={(value) => setContentTab(value as ContentTab)}
        className="flex min-h-0 w-full flex-1 flex-col"
      >
        <TabsList className="grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="typed">Typed</TabsTrigger>
          <TabsTrigger value="ink">Handwritten</TabsTrigger>
        </TabsList>
        <TabsContent value="typed" className="mt-3 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
          <DigitalNoteEditor
            noteKey={note.id}
            value={note.bodyText}
            disabled
            className="min-h-0 flex-1"
            placeholder="This course note has no typed content."
            onChange={() => undefined}
          />
        </TabsContent>
        <TabsContent value="ink" className="mt-3 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
          {hasInk ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)]">
              <CircuitWorkspaceEditor workspace={inkWorkspace} disabled onChange={() => undefined} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--cc-text-muted)]">
              No handwritten pages for this note.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function StudentCourseNotesPanel({
  nativeLayout = false,
  onNativeStackChange,
  layout = "full",
  controlledActiveId = null,
  notesOverride,
}: Props) {
  const [loading, setLoading] = useState(!notesOverride)
  const [notes, setNotes] = useState<CourseDigitalNote[]>(notesOverride ?? [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [nativeScreen, setNativeScreen] = useState<"list" | "read">("list")

  const loadNotes = useCallback(async () => {
    if (notesOverride) return
    setLoading(true)
    try {
      const res = await studentApiFetch("/api/student/course-notes", {
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load course notes")
      const list: CourseDigitalNote[] = data.notes || []
      setNotes(list)
      if (list.length > 0 && selectedId == null) setSelectedId(list[0].id)
    } catch (err: unknown) {
      toast.error("Could not load course notes", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [selectedId, notesOverride])

  useEffect(() => {
    if (notesOverride) {
      setNotes(notesOverride)
      setLoading(false)
    }
  }, [notesOverride])

  useEffect(() => {
    void loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [])

  useEffect(() => {
    if (!nativeLayout) return
    onNativeStackChange?.(nativeScreen === "read")
  }, [nativeLayout, nativeScreen, onNativeStackChange])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.bodyText.toLowerCase().includes(q) ||
        (n.topic?.toLowerCase().includes(q) ?? false),
    )
  }, [notes, search])

  const active =
    layout === "detail"
      ? notes.find((n) => n.id === controlledActiveId) ?? null
      : filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null

  if (layout === "detail") {
    if (loading) {
      return (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
        </div>
      )
    }
    if (!active) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center">
          <BookOpen className="h-9 w-9 text-[var(--cc-accent)]" />
          <p className="text-sm text-[var(--cc-text-muted)]">Select a course note from the list.</p>
        </div>
      )
    }
    if (nativeLayout) {
      return (
        <div className="space-y-3">
          <button
            type="button"
            data-notes-native-stack-back
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)]"
            onClick={() => onNativeStackChange?.(false)}
          >
            <ChevronLeft className="h-4 w-4" />
            All notes
          </button>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <CourseNoteReader note={active} />
          </div>
        </div>
      )
    }
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <CourseNoteReader note={active} />
      </div>
    )
  }

  const openNote = (id: number) => {
    setSelectedId(id)
    if (nativeLayout) setNativeScreen("read")
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="cc-native-empty-block rounded-2xl border border-dashed border-[var(--border)]">
        <span className="cc-native-icon-tile cc-native-icon-tile-accent cc-native-empty-icon">
          <BookOpen className="h-5 w-5" />
        </span>
        <p className="cc-native-empty-title">No course notes yet</p>
        <p className="cc-native-empty-body">
          Your instructor has not published topic notes for your section yet.
        </p>
      </div>
    )
  }

  if (nativeLayout && nativeScreen === "read" && active) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          data-notes-native-stack-back
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)]"
          onClick={() => setNativeScreen("list")}
        >
          <ChevronLeft className="h-4 w-4" />
          Course notes
        </button>
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <CourseNoteReader note={active} />
        </div>
      </div>
    )
  }

  if (nativeLayout) {
    return (
      <div className="space-y-3">
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
          <h2 className="cc-native-section-header">Published notes</h2>
          <div className="cc-native-group">
            {filtered.length === 0 ? (
              <p className="cc-native-empty">No notes match your search.</p>
            ) : (
              <ul className="cc-native-list">
                {filtered.map((note, index) => {
                  const noteHasInk =
                    note.inkWorkspace != null && workspaceHasContent(note.inkWorkspace)
                  return (
                    <li
                      key={note.id}
                      className={cn(
                        "cc-native-note-item",
                        index === filtered.length - 1 && "cc-native-note-item-last",
                      )}
                    >
                      <button
                        type="button"
                        className="cc-native-row cc-native-note-link cc-native-row-last"
                        onClick={() => openNote(note.id)}
                      >
                        <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span className="cc-native-row-copy">
                          <span className="cc-native-row-title truncate">{note.title}</span>
                          <span className="cc-native-row-subtitle truncate">
                            {note.topic || "General topic"}
                            {noteHasInk ? " · Ink" : ""}
                          </span>
                        </span>
                        <ChevronRight className="cc-native-row-chevron" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="grid min-h-[420px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search course notes…"
            className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm"
          />
        </div>
        <div className="max-h-[360px] space-y-1 overflow-y-auto">
          {filtered.map((note) => {
            const noteHasInk =
              note.inkWorkspace != null && workspaceHasContent(note.inkWorkspace)
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  active?.id === note.id
                    ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                    : "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/45",
                )}
              >
                <p className="truncate font-medium">{note.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {note.topic ? (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-[var(--border)]">
                      {note.topic}
                    </Badge>
                  ) : null}
                  {noteHasInk ? (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-[var(--border)]">
                      Ink
                    </Badge>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </aside>
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        {active ? (
          <CourseNoteReader note={active} />
        ) : (
          <p className="text-sm text-[var(--cc-text-muted)]">Select a note</p>
        )}
      </section>
    </div>
  )
}
