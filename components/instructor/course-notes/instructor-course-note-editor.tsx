"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DigitalNoteEditor } from "@/components/student/digital-notes/digital-note-editor"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { isMarkdownNoteContent } from "@/lib/digital-note-content"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { FacultyContentNavigator } from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { cn } from "@/lib/utils"
import { Eye, EyeOff, FilePenLine, Plus } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

const MODULE_ID = "course-notes"

type ContentNavigation = {
  currentIndex: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

type Props = {
  noteId: number | null
  topicNames?: string[]
  onReload: () => Promise<void>
  onDeleted?: () => void
  showCreatePrompt?: boolean
  onCreateNote?: () => void
  navigation?: ContentNavigation
}

export function InstructorCourseNoteEditor({
  noteId,
  topicNames = [],
  onReload,
  onDeleted,
  showCreatePrompt = true,
  onCreateNote,
  navigation,
}: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const [loading, setLoading] = useState(false)
  const { confirm } = useAppConfirm()
  const [title, setTitle] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [topic, setTopic] = useState("")
  const [isPublished, setIsPublished] = useState(false)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadNote = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-notes/${id}`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load note")
      setTitle(data.note.title)
      setBodyText(data.note.bodyText || "")
      setTopic(data.note.topic || "")
      setIsPublished(Boolean(data.note.isPublished))
    } catch (err: unknown) {
      toast.error("Could not load note", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (noteId) {
      void loadNote(noteId)
    } else {
      setTitle("")
      setBodyText("")
      setTopic("")
      setIsPublished(false)
    }
  }, [noteId, loadNote])

  const saveNote = async () => {
    if (!noteId) return
    try {
      const res = await instructorApiFetch(`/api/instructor/course-notes/${noteId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          title,
          bodyText,
          topic: topic.trim() || null,
          isPublished,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Save failed")
      }
      toast.success(isPublished ? "Note published to students" : "Draft saved")
      await onReload()
    } catch (err: unknown) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const deleteNote = async () => {
    if (!noteId) return
    const ok = await confirm({
      title: "Move this note to Deleted Items?",
      description: "You can restore it later from Deleted Items.",
      confirmLabel: "Move to Deleted",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    try {
      const res = await instructorApiFetch(`/api/instructor/course-notes/${noteId}`, {
        method: "DELETE",
        headers: headers(),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      await onReload()
      onDeleted?.()
      toast.success("Note moved to Deleted Items")
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  if (!noteId) {
    if (!showCreatePrompt) {
      return (
        <div className={cn(PORTAL_CARD, "flex min-h-[280px] items-center justify-center p-6 text-sm text-muted-foreground")}>
          Select a note to view and edit content.
        </div>
      )
    }
    return (
      <div className={cn(PORTAL_CARD, "p-4 sm:p-5 min-w-0")}>
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
          <div className={cn("flex size-12 items-center justify-center rounded-2xl", chrome.p.softBg)}>
            <FilePenLine className={cn("h-5 w-5", chrome.p.iconText)} />
          </div>
          <p className="mt-4 text-base font-semibold text-[var(--cc-text)]">Select or create a note</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Author study notes by topic. Published notes appear in student My Notes when the topic is enabled.
          </p>
          {onCreateNote ? (
            <Button size="sm" className={cn("mt-5", chrome.cta)} onClick={onCreateNote}>
              <Plus className="mr-1.5 h-4 w-4" />
              New note
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn(PORTAL_CARD, "flex min-h-[280px] items-center justify-center p-6")}>
        <p className="text-sm text-muted-foreground">Loading note…</p>
      </div>
    )
  }

  return (
    <section className={cn(PORTAL_CARD, "p-4 sm:p-5 min-w-0 space-y-5")}>
      {navigation && navigation.total > 1 ? (
        <FacultyContentNavigator
          currentIndex={navigation.currentIndex}
          total={navigation.total}
          onPrevious={navigation.onPrevious}
          onNext={navigation.onNext}
          itemLabel="note"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="note-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-topic" className="text-xs text-muted-foreground">
            Topic
          </Label>
          <Input
            id="note-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            list="course-note-topic-suggestions"
            className="h-9"
          />
          <datalist id="course-note-topic-suggestions">
            {topicNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Content</Label>
        <DigitalNoteEditor
          noteKey={noteId}
          value={bodyText}
          onChange={setBodyText}
          defaultShowPreview={isMarkdownNoteContent(bodyText)}
          placeholder="Write the study note students will read in My Notes…"
          className="min-h-[52vh]"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPublished ? (
              <Eye className="h-4 w-4 text-emerald-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <Label htmlFor="note-published" className="text-sm">
              Available to students
            </Label>
          </div>
          <Switch
            id="note-published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
            className={chrome.switchChecked}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Published notes appear in My Notes when the topic is enabled in Note Configuration.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className={chrome.cta} onClick={() => void saveNote()}>
          {isPublished ? "Save & publish" : "Save draft"}
        </Button>
        <Button variant="outline" onClick={() => void deleteNote()}>
          Delete note
        </Button>
      </div>
    </section>
  )
}

export type { CourseDigitalNote }
