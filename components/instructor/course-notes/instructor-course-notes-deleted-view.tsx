"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  FacultyIntegratedToolbar,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { Loader2, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "@/lib/app-toast"

type DeletedNote = {
  id: number
  title: string
  topic: string | null
  isPublished: boolean
  deletedAt: string
}

type Props = {
  onRestored: () => Promise<void>
}

export function InstructorCourseNotesDeletedView({ onRestored }: Props) {
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<DeletedNote[]>([])
  const [search, setSearch] = useState("")

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadDeleted = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/deleted", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load deleted notes")
      setNotes(data.notes || [])
    } catch (err: unknown) {
      toast.error("Could not load deleted notes", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDeleted()
  }, [loadDeleted])

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return notes
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(term) ||
        (n.topic ?? "").toLowerCase().includes(term),
    )
  }, [notes, search])

  const restoreNotes = async (noteIds: number[]) => {
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/deleted", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ noteIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Restore failed")
      }
      toast.success("Note restored")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Restore failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const permanentDeleteNotes = async (noteIds: number[]) => {
    if (!confirm("Permanently delete selected notes? This cannot be undone.")) return
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/deleted", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ noteIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      toast.success("Permanently deleted")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const isEmpty = !loading && notes.length === 0

  return (
    <div className="space-y-3 min-w-0">
      <FacultyIntegratedToolbar
        moduleId="course-notes"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search deleted notes…"
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredNotes.length} in trash
            {search.trim() && filteredNotes.length !== notes.length ? ` · ${notes.length} total` : ""}
          </p>
        }
      />

      {loading ? (
        <div className={cn(PORTAL_CARD, "flex min-h-[200px] items-center justify-center")}>
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
        </div>
      ) : isEmpty ? (
        <div className={cn(PORTAL_CARD, "px-4 py-10 text-center text-sm text-muted-foreground")}>
          No deleted notes.
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className={cn(PORTAL_CARD, "px-4 py-10 text-center text-sm text-muted-foreground")}>
          No deleted notes match your search.
        </div>
      ) : (
        <div className={cn(PORTAL_CARD, "p-4 sm:p-5 space-y-2")}>
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200/50 bg-red-50/30 px-3 py-2.5 dark:border-red-500/20 dark:bg-red-500/5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{note.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {note.topic ? (
                    <Badge variant="outline" className="text-[10px]">
                      {note.topic}
                    </Badge>
                  ) : null}
                  <span className="text-[10px] text-muted-foreground">
                    {note.isPublished ? "Was published" : "Draft"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-8" onClick={() => void restoreNotes([note.id])}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-red-600 hover:text-red-700"
                  onClick={() => void permanentDeleteNotes([note.id])}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
