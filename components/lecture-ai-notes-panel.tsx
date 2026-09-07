"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, NotebookPen, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { LectureAiMarkdown } from "@/components/lecture-ai-markdown"
import { CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { createEmptyWorkspace } from "@/lib/circuit-workspace"
import { cn } from "@/lib/utils"

export type LectureAiNote = {
  id: number
  lectureId: number
  lectureTitle: string
  lectureWeek: number
  slideNumber: number
  question: string
  aiResponse: string
  screenshotUrl: string | null
  createdAt: string
}

type LectureAiNotesPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentRosterId: string | null
  lectureId?: number
}

function formatNoteTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function noteTitle(note: LectureAiNote) {
  const question = note.question?.trim()
  if (question) return question.slice(0, 80)
  if (note.lectureTitle) return `AI note · ${note.lectureTitle}`
  return "AI lecture note"
}

function noteMetaLine(note: LectureAiNote) {
  return [
    note.lectureWeek != null ? `Week ${note.lectureWeek}` : null,
    note.lectureTitle || null,
    note.slideNumber ? `Slide ${note.slideNumber}` : null,
    formatNoteTime(note.createdAt) || null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function noteToBodyHtml(note: LectureAiNote) {
  const question = escapeHtml(note.question || "Saved explanation")
  const meta = escapeHtml(noteMetaLine(note))
  const answer = escapeHtml(note.aiResponse || "")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br>")
  const screenshot = note.screenshotUrl
    ? `<p><img src="${escapeHtml(note.screenshotUrl)}" alt="Slide capture" /></p>`
    : ""
  return `<p><strong>${question}</strong></p><p>${meta}</p>${screenshot}<p>${answer}</p>`
}

async function createDigitalNote(title: string, bodyText: string) {
  const res = await studentApiFetch("/api/student/digital-notes", {
    method: "POST",
    headers: {
      ...getStudentAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      bodyText,
      inkWorkspace: createEmptyWorkspace(),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Export failed")
}

export function LectureAiNotesPanel({
  open,
  onOpenChange,
  studentRosterId,
  lectureId,
}: LectureAiNotesPanelProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<LectureAiNote[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState<"one" | "all" | null>(null)
  const [index, setIndex] = useState(0)
  const [exportedIds, setExportedIds] = useState<Set<number>>(new Set())

  const fetchNotes = useCallback(async () => {
    if (!studentRosterId) return
    setLoading(true)
    try {
      const q = new URLSearchParams({ studentId: studentRosterId })
      if (lectureId != null) q.set("lectureId", String(lectureId))
      const res = await studentApiFetch(`/api/student/lecture-notes?${q}`)
      const data = await res.json()
      if (res.ok) {
        setNotes(Array.isArray(data.notes) ? data.notes : [])
        setIndex(0)
      }
    } catch {
      toast({ title: "Failed to load notes", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [studentRosterId, lectureId, toast])

  useEffect(() => {
    if (open) {
      setExportedIds(new Set())
      void fetchNotes()
    }
  }, [open, fetchNotes])

  const note = notes[index] ?? null
  const canPrev = index > 0
  const canNext = index < notes.length - 1

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(notes.length - 1, i + 1))
  }, [notes.length])

  useEffect(() => {
    if (!open || notes.length === 0) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goPrev()
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, notes.length, goPrev, goNext])

  const deleteNote = async (noteId: number) => {
    if (!studentRosterId) return
    setDeletingId(noteId)
    try {
      const res = await fetch(
        `/api/student/lecture-notes/${noteId}?studentId=${encodeURIComponent(studentRosterId)}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Delete failed")
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId)
        setIndex((i) => Math.max(0, Math.min(i, next.length - 1)))
        return next
      })
      toast({ title: "Note deleted" })
    } catch {
      toast({ title: "Could not delete note", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const exportCurrent = async () => {
    if (!note) return
    setExporting("one")
    try {
      await createDigitalNote(noteTitle(note), noteToBodyHtml(note))
      setExportedIds((prev) => new Set(prev).add(note.id))
      toast({ title: "Saved to My Notes" })
    } catch (err) {
      toast({
        title: "Could not export note",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  const exportAll = async () => {
    if (notes.length === 0) return
    setExporting("all")
    try {
      const title =
        notes.length === 1
          ? noteTitle(notes[0])
          : `AI lecture notes (${notes.length})`
      const body = notes.map(noteToBodyHtml).join("<hr>")
      await createDigitalNote(title, body)
      setExportedIds(new Set(notes.map((n) => n.id)))
      toast({ title: "All notes saved to My Notes" })
    } catch (err) {
      toast({
        title: "Could not export notes",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          CC_MODAL_SURFACE,
          "flex max-h-[min(92dvh,820px)] w-[min(90vw,72rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl sm:max-w-[min(90vw,72rem)]",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base text-[var(--cc-text)]">
                <span
                  className="flex size-9 items-center justify-center rounded-[14px]"
                  style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                AI Notes
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--cc-text-muted)]">
                {notes.length} saved
                <span> · from the slide assistant</span>
              </DialogDescription>
            </div>
            {notes.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                disabled={exporting != null}
                onClick={() => void exportAll()}
              >
                {exporting === "all" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save all to My Notes
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--cc-text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading notes…
            </div>
          ) : !note ? (
            <div className="px-4 py-16 text-center">
              <span
                className="mx-auto mb-3 flex size-14 items-center justify-center rounded-[14px]"
                style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
              >
                <Sparkles className="h-6 w-6" aria-hidden />
              </span>
              <p className="text-sm font-medium text-[var(--cc-text)]">No saved notes yet</p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                Open a lecture and ask the slide assistant — answers land here.
              </p>
            </div>
          ) : (
            <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-start gap-3 px-3 py-3 sm:px-5 sm:py-4">
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-[14px] text-xs font-semibold"
                  style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                >
                  {note.slideNumber ? `S${note.slideNumber}` : "AI"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--cc-text)]">
                    {note.question || "Saved explanation"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                    {noteMetaLine(note)}
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-[var(--border)] px-3 py-4 sm:px-5">
                {note.screenshotUrl ? (
                  <a
                    href={note.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-[var(--border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={note.screenshotUrl}
                      alt="Slide capture"
                      className="max-h-56 w-full bg-[var(--muted)] object-contain"
                    />
                  </a>
                ) : null}
                <div className="text-sm text-[var(--cc-text)]">
                  <LectureAiMarkdown content={note.aiResponse || ""} />
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    disabled={exporting != null}
                    onClick={() => void exportCurrent()}
                  >
                    {exporting === "one" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {exportedIds.has(note.id) ? "Saved to My Notes" : "Save to My Notes"}
                  </Button>
                  {note.lectureWeek != null && note.lectureId != null ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs"
                      asChild
                    >
                      <a
                        href={`/student/dashboard-v2/lectures/${note.lectureWeek}?lectureId=${note.lectureId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Open lecture
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs text-[var(--cc-danger)] hover:bg-[var(--cc-danger)]/10"
                    disabled={deletingId === note.id}
                    onClick={() => deleteNote(note.id)}
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          )}
        </div>

        {notes.length > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2.5 sm:px-5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={!canPrev}
              onClick={goPrev}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <p className="text-xs font-medium text-[var(--cc-text-muted)]">
              {index + 1} of {notes.length}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={!canNext}
              onClick={goNext}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
