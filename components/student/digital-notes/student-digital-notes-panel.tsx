"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClassmateShareDialog } from "@/components/student/digital-notes/classmate-share-dialog"
import {
  CreateNoteDialog,
  type CreateNoteDraft,
} from "@/components/student/digital-notes/create-note-dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebouncedCallback } from "@/lib/use-debounced-callback"
import { getStudentAuthHeaders, resolveStudentSection, studentApiFetch } from "@/lib/auth"
import { buildStudentScopedSearchParams, getStudentDatabaseId } from "@/lib/student-session-ids"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"
import {
  buildDigitalNoteExportPayload,
  type StudentDigitalNote,
} from "@/lib/student-digital-notes"
import {
  noteContentPreviewText,
  noteContentToPlainText,
  prepareNoteContentForEditor,
} from "@/lib/digital-note-content"
import { DigitalNoteEditor } from "@/components/student/digital-notes/digital-note-editor"
import {
  createEmptyWorkspace,
  workspaceHasContent,
  workspacePagesWithContent,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"
import { workspacePageToBlob } from "@/lib/circuit-workspace-render"
import { CircuitWorkspaceEditor } from "@/components/circuit-workspace-editor"
import { CircuitWorkspaceBackupActions } from "@/components/circuit-workspace-backup-actions"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  ChevronDown,
  FileJson,
  FileText,
  Loader2,
  NotebookPen,
  PenLine,
  Plus,
  Share2,
  Trash2,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"
import { useNotesChrome } from "@/hooks/use-notes-chrome"
import { toast } from "@/lib/app-toast"

type NoteFilter = "all" | "mine" | "shared"
type NoteSort = "recent" | "title"
type NoteContentFilter = "all" | "typed" | "ink" | "both"

const MODULE_ID = "lectures"

type RosterStudent = {
  id: number
  full_name: string
}

type Props = {
  nativeLayout?: boolean
  /** Open this note after load (e.g. Move to My Notes from AI Notetaker). */
  initialNoteId?: number | null
  /** Native stack: editing a note covers the unified page chrome. */
  onNativeStackChange?: (stacked: boolean) => void
  /** Hub mode: sidebar lives in parent; this renders editor only. */
  layout?: "full" | "detail"
  controlledActiveId?: number | null
  sharedSearch?: string
  notesOverride?: StudentDigitalNote[]
  onNotesChange?: (notes: StudentDigitalNote[]) => void
}

export type StudentDigitalNotesPanelHandle = {
  createNote: () => Promise<void>
}

export const StudentDigitalNotesPanel = forwardRef<StudentDigitalNotesPanelHandle, Props>(
  function StudentDigitalNotesPanel(
    {
      nativeLayout = false,
      initialNoteId = null,
      onNativeStackChange,
      layout = "full",
      controlledActiveId = null,
      sharedSearch,
      notesOverride,
      onNotesChange,
    },
    ref,
  ) {
  const { roles: NOTES, isDark, surfaces } = useNotesChrome()
  const deepLinkNoteId =
    initialNoteId != null && Number.isFinite(initialNoteId) && initialNoteId > 0
      ? initialNoteId
      : null
  const [notes, setNotes] = useState<StudentDigitalNote[]>(notesOverride ?? [])
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [inkWorkspace, setInkWorkspace] = useState<CircuitWorkspace>(createEmptyWorkspace())
  const [loading, setLoading] = useState(!notesOverride)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [search, setSearch] = useState("")
  const effectiveSearch = sharedSearch ?? search
  const [filter, setFilter] = useState<NoteFilter>("all")
  const [sort, setSort] = useState<NoteSort>("recent")
  const [contentFilter, setContentFilter] = useState<NoteContentFilter>("all")
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [selectedShareIds, setSelectedShareIds] = useState<number[]>([])
  const [nativeScreen, setNativeScreen] = useState<"list" | "edit">("list")

  const studentDatabaseId = Number(getStudentDatabaseId() ?? 0)
  const studentSection = resolveStudentSection()

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  )

  const isReadOnly = activeNote?.isOwner === false

  const filteredNotes = useMemo(() => {
    const query = effectiveSearch.trim().toLowerCase()
    let next = notes.filter((note) => {
      if (filter === "mine" && note.isOwner === false) return false
      if (filter === "shared" && note.isOwner !== false) return false
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
  }, [notes, effectiveSearch, filter, sort, contentFilter])

  useEffect(() => {
    if (layout !== "detail" || controlledActiveId == null) return
    setActiveNoteId(controlledActiveId)
    if (nativeLayout) setNativeScreen("edit")
  }, [layout, controlledActiveId, nativeLayout])

  const loadNotes = useCallback(async () => {
    if (notesOverride) return
    setLoading(true)
    try {
      const res = await studentApiFetch("/api/student/digital-notes", {
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load notes")
      const loaded = (data.notes || []) as StudentDigitalNote[]
      setNotes(loaded)
      if (loaded.length > 0) {
        setActiveNoteId((prev) => {
          if (deepLinkNoteId != null && loaded.some((note) => note.id === deepLinkNoteId)) {
            return deepLinkNoteId
          }
          return prev != null && loaded.some((note) => note.id === prev) ? prev : loaded[0].id
        })
        if (deepLinkNoteId != null && loaded.some((note) => note.id === deepLinkNoteId) && nativeLayout) {
          setNativeScreen("edit")
        }
      } else {
        setActiveNoteId(null)
      }
    } catch (err: unknown) {
      toast.error("Could not load notes", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [deepLinkNoteId, nativeLayout, notesOverride])

  useEffect(() => {
    if (!notesOverride) return
    setNotes(notesOverride)
    setLoading(false)
  }, [notesOverride])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (!activeNote) {
      setTitle("")
      setBodyText("")
      setInkWorkspace(createEmptyWorkspace())
      return
    }
    setTitle(activeNote.title)
    // Preserve markdown/Cora notes as markdown; TipTap path only for HTML bodies.
    setBodyText(prepareNoteContentForEditor(activeNote.bodyText))
    setInkWorkspace(activeNote.inkWorkspace ?? createEmptyWorkspace())
  }, [activeNote])

  const saveNote = useCallback(
    async (patch: {
      title?: string
      bodyText?: string
      inkWorkspace?: CircuitWorkspace
    }) => {
      if (!activeNoteId || isReadOnly) return
      setSaving(true)
      try {
        const res = await studentApiFetch(`/api/student/digital-notes/${activeNoteId}`, {
          method: "PATCH",
          headers: {
            ...getStudentAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: patch.title ?? title,
            bodyText: patch.bodyText ?? bodyText,
            inkWorkspace: patch.inkWorkspace ?? inkWorkspace,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Save failed")
        const saved = data.note as StudentDigitalNote
        const next = notes.map((note) =>
          note.id === saved.id ? { ...saved, isOwner: note.isOwner ?? true } : note,
        )
        setNotes(next)
        queueMicrotask(() => onNotesChange?.(next))
      } catch (err: unknown) {
        toast.error("Save failed", {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setSaving(false)
      }
    },
    [activeNoteId, title, bodyText, inkWorkspace, isReadOnly, notes, onNotesChange],
  )

  const debouncedSave = useDebouncedCallback(
    (patch: { title?: string; bodyText?: string; inkWorkspace?: CircuitWorkspace }) => {
      void saveNote(patch)
    },
    900,
  )

  const handleCreateNote = async (draft: CreateNoteDraft) => {
    setCreating(true)
    try {
      const res = await studentApiFetch("/api/student/digital-notes", {
        method: "POST",
        headers: {
          ...getStudentAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: draft.title,
          bodyText: draft.description,
          iconColor: draft.iconColor,
          inkWorkspace: createEmptyWorkspace(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      const created = data.note as StudentDigitalNote
      const next = [{ ...created, isOwner: true }, ...notes]
      setNotes(next)
      queueMicrotask(() => onNotesChange?.(next))
      setActiveNoteId(created.id)
      setFilter("all")
      setCreateOpen(false)
      if (nativeLayout) setNativeScreen("edit")
    } catch (err: unknown) {
      toast.error("Could not create note", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  useImperativeHandle(ref, () => ({
    createNote: async () => {
      setCreateOpen(true)
    },
  }))

  useEffect(() => {
    if (!nativeLayout) return
    onNativeStackChange?.(nativeScreen === "edit")
  }, [nativeLayout, nativeScreen, onNativeStackChange])

  const handleDeleteNote = async () => {
    if (!activeNoteId || isReadOnly) return
    try {
      const res = await studentApiFetch(`/api/student/digital-notes/${activeNoteId}`, {
        method: "DELETE",
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      const next = notes.filter((note) => note.id !== activeNoteId)
      setNotes(next)
      setActiveNoteId(next[0]?.id ?? null)
      queueMicrotask(() => onNotesChange?.(next))
      toast.success("Note deleted")
    } catch (err: unknown) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const loadShareDialog = useCallback(async () => {
    if (!activeNoteId) return
    setShareLoading(true)
    try {
      const rosterParams = buildStudentScopedSearchParams({ section: studentSection })
      const [rosterRes, sharesRes] = await Promise.all([
        studentApiFetch(`/api/student/roster?${rosterParams}`),
        studentApiFetch(`/api/student/digital-notes/${activeNoteId}/share`, {
          headers: getStudentAuthHeaders(),
        }),
      ])
      const rosterData = await rosterRes.json()
      const sharesData = await sharesRes.json()
      if (!rosterRes.ok) throw new Error(rosterData.error || "Failed to load classmates")
      if (!sharesRes.ok) throw new Error(sharesData.error || "Failed to load shares")

      const classmates = ((rosterData.students || []) as RosterStudent[]).filter(
        (student) => student.id !== studentDatabaseId,
      )
      setRoster(classmates)
      setSelectedShareIds(
        ((sharesData.shares || []) as Array<{ studentDatabaseId: number }>).map(
          (share) => share.studentDatabaseId,
        ),
      )
    } catch (err: unknown) {
      toast.error("Could not open share dialog", {
        description: err instanceof Error ? err.message : undefined,
      })
      setShareOpen(false)
    } finally {
      setShareLoading(false)
    }
  }, [activeNoteId, studentSection, studentDatabaseId])

  useEffect(() => {
    if (shareOpen) void loadShareDialog()
  }, [shareOpen, loadShareDialog])

  const handleSaveShares = async () => {
    if (!activeNoteId) return
    setShareSaving(true)
    try {
      const res = await studentApiFetch(`/api/student/digital-notes/${activeNoteId}/share`, {
        method: "PUT",
        headers: {
          ...getStudentAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentDatabaseIds: selectedShareIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Share update failed")
      toast.success(
        selectedShareIds.length > 0
          ? `Shared with ${selectedShareIds.length} classmate${selectedShareIds.length === 1 ? "" : "s"}`
          : "Sharing removed",
      )
      setShareOpen(false)
    } catch (err: unknown) {
      toast.error("Share failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setShareSaving(false)
    }
  }

  const handleDownloadJson = () => {
    if (!activeNote) return
    const payload = buildDigitalNoteExportPayload({
      ...activeNote,
      title,
      bodyText,
      inkWorkspace: workspaceHasContent(inkWorkspace) ? inkWorkspace : null,
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${title.replace(/[^\w.-]+/g, "-") || "note"}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadText = () => {
    const blob = new Blob([noteContentToPlainText(bodyText)], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${title.replace(/[^\w.-]+/g, "-") || "note"}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadInk = async () => {
    const pages = workspacePagesWithContent(inkWorkspace)
    if (pages.length === 0) {
      toast.info("No handwritten pages to export")
      return
    }
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i]
      const blob = await workspacePageToBlob(page, {
        pageIndex: i,
        totalPages: pages.length,
        title,
      })
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${title.replace(/[^\w.-]+/g, "-") || "note"}-page-${i + 1}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    }
  }

  const mineCount = notes.filter((note) => note.isOwner !== false).length
  const sharedCount = notes.filter((note) => note.isOwner === false).length
  const noteCounts: Record<NoteFilter, number> = {
    all: notes.length,
    mine: mineCount,
    shared: sharedCount,
  }
  const activeToolbarFilters =
    (sort !== "recent" ? 1 : 0) + (contentFilter !== "all" ? 1 : 0)
  const desktopNative = isDesktopAppShell()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass(MODULE_ID))} />
      </div>
    )
  }

  const editorSection = !activeNote ? (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        desktopNative ? "h-full min-h-0 px-6" : "min-h-[40vh]",
      )}
    >
      <NotebookPen className={cn(desktopNative ? "h-6 w-6 text-[#9ca3af]" : "h-10 w-10 text-[var(--cc-accent)]")} />
      <p className={cn(desktopNative ? "text-[13px] text-[#6b7280]" : "text-sm text-[var(--cc-text-muted)]")}>
        Create a note to type ideas or sketch with stylus, pencil, or finger.
      </p>
      <Button
        onClick={() => setCreateOpen(true)}
        disabled={creating}
        className={desktopNative ? "h-8 rounded-[6px] px-3 text-[12px]" : "rounded-full"}
      >
        New note
      </Button>
    </div>
  ) : (
    <div className={cn("flex h-full min-h-0 flex-col", desktopNative ? "gap-2.5" : "gap-3")}>
      <div className="min-w-0 shrink-0 space-y-1">
          <Input
            value={title}
            onChange={(e) => {
              if (isReadOnly) return
              setTitle(e.target.value)
              debouncedSave({ title: e.target.value })
            }}
            readOnly={isReadOnly}
            className={cn(
              "max-w-xl border-0 bg-transparent px-0 font-semibold shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
              desktopNative ? "h-8 text-[15px] tracking-tight" : "h-9 text-lg",
            )}
            placeholder="Note title"
          />
          {isReadOnly && activeNote.ownerName ? (
            <p className="text-xs text-[var(--cc-text-muted)]">
              Shared by {activeNote.ownerName} · view only
            </p>
          ) : null}
        </div>

      <Tabs
        defaultValue="typed"
        className="flex min-h-0 flex-1 flex-col"
        style={
          {
            "--notes-tab-track": (isDark ? surfaces.tabTrackDark : surfaces.tabTrack).backgroundColor,
            "--notes-tab-active-bg": (isDark ? surfaces.tabActiveDark : surfaces.tabActive).backgroundColor,
            "--notes-tab-active-fg": (isDark ? surfaces.tabActiveDark : surfaces.tabActive).color,
          } as CSSProperties
        }
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <TabsList
            className={cn(
              "w-auto shrink-0 border-0 shadow-none text-[var(--cc-text-muted)]",
              desktopNative
                ? "h-8 rounded-[6px] bg-[#f3f4f6] p-0.5 dark:bg-[#1a1a1a]"
                : "h-9 rounded-full bg-[var(--notes-tab-track)] p-1",
            )}
          >
            <TabsTrigger
              value="typed"
              className={cn(
                "border-0 shadow-none data-[state=active]:border-transparent data-[state=active]:shadow-none",
                desktopNative
                  ? "h-7 rounded-[5px] px-2.5 text-[12px] data-[state=active]:bg-white dark:data-[state=active]:bg-[#171717]"
                  : "rounded-full px-3 data-[state=active]:bg-[var(--notes-tab-active-bg)] data-[state=active]:text-[var(--notes-tab-active-fg)] sm:px-4",
              )}
            >
              Typed
            </TabsTrigger>
            <TabsTrigger
              value="ink"
              className={cn(
                "border-0 shadow-none data-[state=active]:border-transparent data-[state=active]:shadow-none",
                desktopNative
                  ? "h-7 rounded-[5px] px-2.5 text-[12px] data-[state=active]:bg-white dark:data-[state=active]:bg-[#171717]"
                  : "rounded-full px-3 data-[state=active]:bg-[var(--notes-tab-active-bg)] data-[state=active]:text-[var(--notes-tab-active-fg)] sm:px-4",
              )}
            >
              Ink
            </TabsTrigger>
          </TabsList>
          {saving && !isReadOnly ? (
            <span className="hidden text-xs text-[var(--cc-text-muted)] sm:inline">Saving…</span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {!isReadOnly ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "text-[var(--cc-text)]",
                  desktopNative ? "h-8 rounded-[6px] px-2 text-[12px]" : "h-9 rounded-xl px-2.5",
                )}
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Share</span>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "text-[var(--cc-text)]",
                    desktopNative ? "h-8 rounded-[6px] px-2 text-[12px]" : "h-9 rounded-xl px-2.5",
                  )}
                >
                  Export
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadText}>
                  <FileText className="h-4 w-4" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDownloadInk()}>
                  <PenLine className="h-4 w-4" />
                  Ink PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadJson}>
                  <FileJson className="h-4 w-4" />
                  JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!isReadOnly ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "text-[var(--cc-danger)]",
                  desktopNative ? "h-8 rounded-[6px] px-2" : "h-9 rounded-xl px-2.5",
                )}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <TabsContent
          value="typed"
          className={cn(
            "min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col",
            desktopNative ? "mt-1.5" : "mt-3",
          )}
        >
          <DigitalNoteEditor
            noteKey={activeNoteId}
            value={bodyText}
            disabled={isReadOnly}
            className="min-h-0 flex-1"
            placeholder="Start typing your notes… Use the toolbar below for headings, lists, and formatting."
            onChange={(html) => {
              if (isReadOnly) return
              setBodyText(html)
              debouncedSave({ bodyText: html })
            }}
          />
        </TabsContent>
        <TabsContent
          value="ink"
          className={cn(
            "min-h-0 flex-1 space-y-3 data-[state=active]:flex data-[state=active]:flex-col",
            desktopNative ? "mt-1.5" : "mt-3",
          )}
        >
          {!isReadOnly ? (
            <CircuitWorkspaceBackupActions
              workspace={inkWorkspace}
              onImport={(next) => {
                setInkWorkspace(next)
                debouncedSave({ inkWorkspace: next })
              }}
              filenameBase={title || "note-ink"}
            />
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)]">
            <CircuitWorkspaceEditor
              workspace={inkWorkspace}
              disabled={isReadOnly}
              onChange={(next, options) => {
                if (isReadOnly) return
                setInkWorkspace(next)
                if (options?.flush) {
                  void saveNote({ inkWorkspace: next })
                } else {
                  debouncedSave({ inkWorkspace: next })
                }
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  const shareDialog = (
    <>
      <CreateNoteDialog
        open={createOpen}
        creating={creating}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateNote}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {title || activeNote?.title || "Untitled note"} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="border-0 bg-[var(--cc-danger)] text-white hover:opacity-90"
              onClick={() => void handleDeleteNote()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ClassmateShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        subjectLabel={title || activeNote?.title || "Untitled note"}
        roster={roster}
        selectedIds={selectedShareIds}
        onSelectedIdsChange={setSelectedShareIds}
        loading={shareLoading}
        saving={shareSaving}
        onSave={handleSaveShares}
        nativeLayout={nativeLayout}
      />
    </>
  )

  if (nativeLayout && nativeScreen === "edit") {
    const backLabel = layout === "detail" ? "All notes" : "My notes"
    return (
      <div className="space-y-3">
        <button
          type="button"
          data-notes-native-stack-back
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)]"
          onClick={() => {
            setNativeScreen("list")
            onNativeStackChange?.(false)
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <section className={cn(PORTAL_CARD, "p-4 sm:p-5")}>{editorSection}</section>
        {shareDialog}
      </div>
    )
  }

  if (layout === "detail") {
    if (loading) {
      return (
        <div
          className={cn(
            "flex items-center justify-center",
            desktopNative ? "h-full min-h-0" : "min-h-[320px]",
          )}
        >
          <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass(MODULE_ID))} />
        </div>
      )
    }
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        {editorSection}
        {shareDialog}
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
            placeholder="Search notes…"
            className="cc-native-search-input"
          />
        </div>

        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Browse</h2>
          <div className="cc-native-group">
            {(
              [
                { id: "all" as const, label: "All notes", count: noteCounts.all },
                { id: "mine" as const, label: "Mine", count: noteCounts.mine },
                { id: "shared" as const, label: "Shared with me", count: noteCounts.shared },
              ] as const
            ).map((item, index, arr) => (
              <button
                key={item.id}
                type="button"
                className={cn("cc-native-row", index === arr.length - 1 && "cc-native-row-last", filter === item.id && "bg-[var(--sidebar-accent)]/35")}
                onClick={() => setFilter(item.id)}
              >
                <span className="cc-native-row-copy">
                  <span className="cc-native-row-title">{item.label}</span>
                  <span className="cc-native-row-subtitle">{item.count} notes</span>
                </span>
                {filter === item.id ? (
                  <span className="cc-native-status-pill">Active</span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Notes</h2>
          <div className="cc-native-group">
            {filteredNotes.length === 0 ? (
              <div className="cc-native-empty-block">
                <span className="cc-native-icon-tile cc-native-icon-tile-accent cc-native-empty-icon">
                  <NotebookPen className="h-5 w-5" />
                </span>
                <p className="cc-native-empty-title">No notes yet</p>
                <p className="cc-native-empty-body">Tap below to create your first note.</p>
              </div>
            ) : (
              <ul className="cc-native-list">
                {filteredNotes.map((note, index) => (
                  <li
                    key={note.id}
                    className={cn(
                      "cc-native-note-item",
                      index === filteredNotes.length - 1 && "cc-native-note-item-last",
                    )}
                  >
                    <button
                      type="button"
                      className="cc-native-row cc-native-note-link cc-native-row-last"
                      onClick={() => {
                        setActiveNoteId(note.id)
                        setNativeScreen("edit")
                      }}
                    >
                      <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                        <NotebookPen className="h-4 w-4" />
                      </span>
                      <span className="cc-native-row-copy">
                        <span className="cc-native-row-title truncate">{note.title}</span>
                        <span className="cc-native-row-subtitle truncate">
                          {note.isOwner === false && note.ownerName
                            ? `Shared by ${note.ownerName}`
                            : new Date(note.updatedAt).toLocaleString()}
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
          type="button"
          className="w-full gap-2 rounded-xl bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white"
          onClick={() => setCreateOpen(true)}
          disabled={creating}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New note
        </Button>
        {shareDialog}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId={MODULE_ID}
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search notes…"
        filters={
          <>
            <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(sort !== "recent")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={contentFilter}
              onValueChange={(value) => setContentFilter(value as NoteContentFilter)}
            >
              <SelectTrigger
                className={cn(
                  facultyToolbarSelectTriggerClass(contentFilter !== "all"),
                  "w-[7rem] sm:w-[8rem]",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All content</SelectItem>
                <SelectItem value="typed">Typed only</SelectItem>
                <SelectItem value="ink">Handwritten</SelectItem>
                <SelectItem value="both">Typed + ink</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredNotes.length} shown · {mineCount} mine · {sharedCount} shared
            {activeToolbarFilters > 0
              ? ` · ${activeToolbarFilters} filter${activeToolbarFilters === 1 ? "" : "s"} active`
              : ""}
          </p>
        }
        trailing={
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
            onClick={() => setCreateOpen(true)}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New note
          </Button>
        }
      />

      <FacultyModuleSplitLayout
        className="lg:min-h-[min(640px,70vh)]"
        menu={
          <div className="flex h-full min-h-0 flex-col space-y-3">
            <FacultyModuleSideMenu
              moduleId={MODULE_ID}
              accent={{ soft: NOTES.browse.soft, ink: NOTES.browse.ink }}
              title="Browse"
              activeId={filter}
              onSelect={(id) => setFilter(id as NoteFilter)}
              items={[
                { id: "all", label: "All notes", icon: NotebookPen, badge: noteCounts.all },
                { id: "mine", label: "Mine", icon: UserRound, badge: noteCounts.mine },
                { id: "shared", label: "Shared", icon: Share2, badge: noteCounts.shared },
              ]}
            />
            <div className={cn(PORTAL_CARD, "min-h-0 flex-1 overflow-hidden p-1.5")}>
              <ul className="h-full space-y-0.5 overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <li className="px-3 py-4 text-xs text-[var(--cc-text-muted)]">
                    {notes.length === 0
                      ? "No notes yet. Tap + to create one."
                      : "No notes match your search or filters."}
                  </li>
                ) : (
                  filteredNotes.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => setActiveNoteId(note.id)}
                        className={cn(
                          "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                          activeNoteId === note.id
                            ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                            : "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/45 hover:text-[var(--cc-text)]",
                        )}
                      >
                        <p className="truncate text-sm font-medium">{note.title}</p>
                        {note.bodyText.trim() ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed opacity-75">
                            {noteContentPreviewText(note.bodyText, 120)}
                          </p>
                        ) : null}
                        {note.isOwner === false && note.ownerName ? (
                          <p className="truncate text-[11px] text-[var(--cc-accent-dark)]">
                            Shared by {note.ownerName}
                          </p>
                        ) : null}
                        <p className="truncate text-[11px] opacity-70">
                          {new Date(note.updatedAt).toLocaleString()}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        }
      >
        <section className={cn(PORTAL_CARD, "flex h-full min-h-0 flex-col p-4")}>
          {editorSection}
        </section>
      </FacultyModuleSplitLayout>

      {shareDialog}
    </div>
  )
},
)
