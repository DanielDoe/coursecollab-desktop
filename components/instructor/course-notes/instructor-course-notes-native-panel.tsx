"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, FilePenLine, FolderOpen, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { InstructorCourseNotesAllView } from "@/components/instructor/course-notes/instructor-course-notes-all-view"
import { InstructorCourseNotesTopicsView } from "@/components/instructor/course-notes/instructor-course-notes-topics-view"
import { InstructorCourseNotesConfigView } from "@/components/instructor/course-notes/instructor-course-notes-config-view"
import { InstructorCourseNotesDeletedView } from "@/components/instructor/course-notes/instructor-course-notes-deleted-view"
import type { CourseNoteMenu } from "@/components/instructor/course-notes/instructor-course-notes-panel"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-toast"

const MODULE_ID = "course-notes"

const MENU: Array<{ id: CourseNoteMenu; label: string; icon: typeof FilePenLine }> = [
  { id: "all", label: "All Notes", icon: FilePenLine },
  { id: "topics", label: "Topics", icon: FolderOpen },
  { id: "configuration", label: "Note Configuration", icon: SlidersHorizontal },
  { id: "deleted", label: "Deleted Items", icon: Trash2 },
]

export function InstructorCourseNotesNativePanel() {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<CourseDigitalNote[]>([])
  const [deletedCount, setDeletedCount] = useState(0)
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [activeMenu, setActiveMenu] = useState<CourseNoteMenu | null>(null)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load notes")
      setNotes(data.notes || [])
    } catch (err: unknown) {
      toast.error("Could not load course notes", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDeletedCount = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/deleted", { headers: headers() })
      const data = await res.json()
      if (res.ok) setDeletedCount(data.notes?.length ?? 0)
    } catch {
      /* optional */
    }
  }, [])

  const reload = useCallback(async () => {
    await loadNotes()
    await loadDeletedCount()
  }, [loadNotes, loadDeletedCount])

  useEffect(() => {
    void loadNotes()
    void loadDeletedCount()
  }, [loadNotes, loadDeletedCount])

  const topicCount = useMemo(() => {
    const names = new Set<string>()
    for (const note of notes) names.add(note.topic?.trim() || "General")
    return names.size
  }, [notes])

  if (loading && notes.length === 0 && activeMenu == null) {
    return (
      <div data-faculty-notes-native-root className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className={cn("h-8 w-8 animate-spin", chrome.p.iconText)} />
      </div>
    )
  }

  if (activeMenu == null) {
    return (
      <div data-faculty-notes-native-root className="cc-native-notetaker">
        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Course Notes</h2>
          <div className="cc-native-group">
            {MENU.map((item, index) => {
              const Icon = item.icon
              const badge =
                item.id === "topics"
                  ? topicCount
                  : item.id === "deleted" && deletedCount > 0
                    ? deletedCount
                    : null
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "cc-native-row",
                    index === MENU.length - 1 && "cc-native-row-last",
                    item.id === "deleted" && "text-red-600 dark:text-red-400",
                  )}
                  onClick={() => setActiveMenu(item.id)}
                >
                  <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="cc-native-row-copy">
                    <span className="cc-native-row-title">{item.label}</span>
                  </span>
                  {badge != null ? (
                    <span className="cc-native-status-pill">{badge}</span>
                  ) : null}
                  <ChevronRight className="cc-native-row-chevron" aria-hidden />
                </button>
              )
            })}
          </div>
        </section>

        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Quick capture</h2>
          <div className="cc-native-group">
            <button
              type="button"
              className="cc-native-row cc-native-row-primary cc-native-row-last"
              onClick={() => {
                setActiveMenu("all")
                void (async () => {
                  try {
                    const res = await instructorApiFetch("/api/instructor/course-notes", {
                      method: "POST",
                      headers: headers(),
                      body: JSON.stringify({ title: "New course note", isPublished: false }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Create failed")
                    await reload()
                    setSelectedNoteId(data.note.id)
                  } catch (err: unknown) {
                    toast.error("Create failed", {
                      description: err instanceof Error ? err.message : undefined,
                    })
                  }
                })()
              }}
            >
              <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                <Plus className="h-4 w-4" />
              </span>
              <span className="cc-native-row-copy">
                <span className="cc-native-row-title">New course note</span>
                <span className="cc-native-row-subtitle">Draft · publish when ready</span>
              </span>
              <ChevronRight className="cc-native-row-chevron" aria-hidden />
            </button>
          </div>
        </section>
      </div>
    )
  }

  const menuLabel = MENU.find((m) => m.id === activeMenu)?.label ?? "Course Notes"

  return (
    <div data-faculty-notes-native-root className="cc-native-notetaker space-y-3">
      <button
        type="button"
        data-notes-native-stack-back
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)]"
        onClick={() => {
          setActiveMenu(null)
          setSelectedNoteId(null)
        }}
      >
        <ChevronLeft className="h-4 w-4" />
        {menuLabel}
      </button>

      {activeMenu === "all" ? (
        <InstructorCourseNotesAllView
          nativeLayout
          notes={notes}
          selectedNoteId={selectedNoteId}
          topicFilter={null}
          onSelectNote={setSelectedNoteId}
          onClearTopicFilter={() => {}}
          onReload={reload}
        />
      ) : null}
      {activeMenu === "topics" ? (
        <InstructorCourseNotesTopicsView notes={notes} onReload={reload} />
      ) : null}
      {activeMenu === "configuration" ? <InstructorCourseNotesConfigView /> : null}
      {activeMenu === "deleted" ? <InstructorCourseNotesDeletedView onRestored={reload} /> : null}
    </div>
  )
}
