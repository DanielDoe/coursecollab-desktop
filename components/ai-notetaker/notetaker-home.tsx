"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Clock,
  Mic,
  Upload,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  MaterialInteractiveSurface,
  materialSurfaceClass,
} from "@/components/ui/material-interactive-surface"
import { useNotetakerStudent } from "@/hooks/use-notetaker-student"
import { useNotetakerChrome } from "@/hooks/use-notetaker-chrome"
import { notetakerAuthHeaders, notetakerListUrl } from "@/lib/notetaker-client"
import {
  archiveNotetakerNote,
  loadArchivedNoteIds,
  removeArchivedNotetakerNote,
  restoreNotetakerNote,
} from "@/lib/notetaker-archive-storage"
import { NotetakerNativeHome } from "@/components/ai-notetaker/notetaker-native-home"
import {
  notetakerListThumbAt,
  notetakerStatusThumb,
} from "@/lib/notetaker-list-theme"
import { notetakerTextMuted } from "@/lib/ai-notetaker-ui-theme"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-toast"

type NoteRow = {
  id: number
  slug?: string
  title: string
  course_name: string | null
  lecture_date: string | null
  processing_status: string
  duration_seconds: number | null
  created_at: string
}

type LimitsPayload = {
  tier: string
  maxNoteDurationMinutes: number
  transcriptionMinutes: number
  maxNotesPerMonth: number
  chatEnabled: boolean
  maxChatMessagesPerMonth: number
}

type BrowseFilter = "all" | "ready" | "processing" | "archived"
type NoteSort = "recent" | "title"

const MODULE_ID = "ai-notetaker"

function statusIsReady(status: string) {
  const s = status.toLowerCase()
  return s.includes("ready") || s.includes("complete") || s === "done"
}

function statusIsProcessing(status: string) {
  const s = status.toLowerCase()
  return (
    s.includes("process") ||
    s.includes("transcrib") ||
    s.includes("summar") ||
    s.includes("pending") ||
    s.includes("queue")
  )
}

function noteListIcon(status: string) {
  const s = status.toLowerCase()
  if (s.includes("fail") || s.includes("error")) return AlertCircle
  if (statusIsReady(status)) return CheckCircle2
  if (statusIsProcessing(status)) return Clock
  return Mic
}

export function NotetakerHome() {
  const { studentDbId, isNativeApp, navPath, goTo } = useNotetakerStudent()
  const chrome = useNotetakerChrome()
  const { roles: ROLES } = chrome
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [limits, setLimits] = useState<LimitsPayload | null>(null)
  const [usage, setUsage] = useState<{ notesThisMonth: number; transcriptionMinutesUsed: number } | null>(null)
  const [notesLoading, setNotesLoading] = useState(true)
  const hasLoadedOnceRef = useRef(false)
  const [creatingMode, setCreatingMode] = useState<"record" | "upload" | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [tierBlockedMessage, setTierBlockedMessage] = useState<string | null>(null)
  const [notePendingDelete, setNotePendingDelete] = useState<NoteRow | null>(null)
  const [errorDialog, setErrorDialog] = useState<string | null>(null)
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set())
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>("all")
  const [sort, setSort] = useState<NoteSort>("recent")
  const [renameNote, setRenameNote] = useState<NoteRow | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!studentDbId) {
      setArchivedIds(new Set())
      return
    }
    setArchivedIds(loadArchivedNoteIds(studentDbId))
  }, [studentDbId])

  const load = useCallback(async () => {
    if (!studentDbId) {
      setNotesLoading(false)
      return
    }
    if (!hasLoadedOnceRef.current) setNotesLoading(true)
    try {
      const res = await fetch(
        notetakerListUrl(studentDbId, debouncedQ, { limit: isNativeApp ? 15 : 30 }),
        { headers: notetakerAuthHeaders(studentDbId) },
      )
      const data = await res.json()
      if (res.status === 403 && data.code === "NOTETAKER_TIER") {
        setTierBlockedMessage(data.error || "This feature requires Explorer or Trailblazer.")
        setNotes([])
        setLimits(null)
        setUsage(null)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setTierBlockedMessage(null)
      setNotes(data.notes || [])
      setLimits(data.limits)
      setUsage(data.usage)
      hasLoadedOnceRef.current = true
      if (isNativeApp && typeof window !== "undefined") {
        const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
          .ReactNativeWebView
        bridge?.postMessage(JSON.stringify({ type: "NOTETAKER_READY" }))
      }
    } catch (e) {
      console.error(e)
      if (!hasLoadedOnceRef.current) setNotes([])
      setErrorDialog("Could not load your notes. Try again in a moment.")
    } finally {
      setNotesLoading(false)
    }
  }, [studentDbId, debouncedQ, isNativeApp])

  useEffect(() => {
    void load()
  }, [load])

  const goToNewLecture = (mode: "record" | "upload") => {
    goTo(`/student/dashboard-v2/ai-notetaker/new?mode=${mode}`)
  }

  const noteHref = (n: Pick<NoteRow, "id" | "slug">) =>
    navPath(`/student/dashboard-v2/ai-notetaker/${encodeURIComponent(n.slug ?? String(n.id))}`)

  const openDeleteConfirm = (n: NoteRow, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!studentDbId) return
    setNotePendingDelete(n)
  }

  const runDeleteNote = async () => {
    const n = notePendingDelete
    if (!n || !studentDbId) return
    setNotePendingDelete(null)
    setDeletingId(n.id)
    try {
      const seg = encodeURIComponent(n.slug ?? String(n.id))
      const res = await fetch(
        `/api/student/ai-notetaker/${seg}?studentDatabaseId=${encodeURIComponent(studentDbId)}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Delete failed")
      }
      setArchivedIds(removeArchivedNotetakerNote(studentDbId, n.id))
      await load()
    } catch (err: unknown) {
      setErrorDialog(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  const archivedCount = notes.filter((n) => archivedIds.has(n.id)).length
  const readyCount = notes.filter((n) => !archivedIds.has(n.id) && statusIsReady(n.processing_status)).length
  const processingCount = notes.filter(
    (n) => !archivedIds.has(n.id) && statusIsProcessing(n.processing_status),
  ).length
  const activeCount = notes.filter((n) => !archivedIds.has(n.id)).length

  const visibleNotes = notes
    .filter((n) => {
      const archived = archivedIds.has(n.id)
      if (browseFilter === "archived") return archived
      if (archived) return false
      if (browseFilter === "ready") return statusIsReady(n.processing_status)
      if (browseFilter === "processing") return statusIsProcessing(n.processing_status)
      return true
    })
    .slice()
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const showArchived = browseFilter === "archived"

  const archiveNote = (n: Pick<NoteRow, "id">, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!studentDbId) return
    setArchivedIds(archiveNotetakerNote(studentDbId, n.id))
    toast.success("Archived on this device")
  }

  const restoreNote = (n: Pick<NoteRow, "id">, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!studentDbId) return
    setArchivedIds(restoreNotetakerNote(studentDbId, n.id))
    toast.success("Restored")
  }

  const openRename = (n: NoteRow, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRenameNote(n)
    setRenameTitle(n.title)
  }

  const saveRename = async () => {
    if (!renameNote || !studentDbId) return
    const nextTitle = renameTitle.trim() || "Untitled lecture"
    setRenaming(true)
    try {
      const seg = encodeURIComponent(renameNote.slug ?? String(renameNote.id))
      const res = await fetch(
        `/api/student/ai-notetaker/${seg}?studentDatabaseId=${encodeURIComponent(studentDbId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Rename failed")
      setRenameNote(null)
      toast.success("Title updated")
      await load()
    } catch (err: unknown) {
      setErrorDialog(err instanceof Error ? err.message : "Rename failed")
    } finally {
      setRenaming(false)
    }
  }

  const pctUsed =
    limits && usage
      ? Math.min(100, (usage.transcriptionMinutesUsed / Math.max(1, limits.transcriptionMinutes)) * 100)
      : 0

  const listDialogs = (
    <>
      <AlertDialog open={!!notePendingDelete} onOpenChange={(open) => !open && setNotePendingDelete(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lecture note?</AlertDialogTitle>
            <AlertDialogDescription>
              {notePendingDelete
                ? `Delete “${notePendingDelete.title}”? This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <Button
              type="button"
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
              onClick={() => void runDeleteNote()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameNote} onOpenChange={(open) => !open && setRenameNote(null)}>
        <DialogContent className="rounded-xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit title</DialogTitle>
            <DialogDescription className={notetakerTextMuted}>
              Rename this lecture note without opening the full detail page.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            className="rounded-lg"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void saveRename()
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setRenameNote(null)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-full" disabled={renaming} onClick={() => void saveRename()}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorDialog} onOpenChange={(open) => !open && setErrorDialog(null)}>
        <DialogContent className="rounded-xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Something went wrong</DialogTitle>
            <DialogDescription className={notetakerTextMuted}>{errorDialog}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="rounded-full" onClick={() => setErrorDialog(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!studentDbId) {
    if (isNativeApp) {
      return (
        <NotetakerNativeHome
          q={q}
          onSearchChange={setQ}
          limits={null}
          usage={null}
          pctUsed={0}
          tierBlockedMessage={null}
          notes={[]}
          notesLoading
          hasLoadedOnce={false}
          creatingMode={creatingMode}
          deletingId={deletingId}
          navPath={navPath}
          noteHref={noteHref}
          showArchived={false}
          archivedCount={0}
          onToggleArchived={() => setBrowseFilter("archived")}
          onRecord={() => goToNewLecture("record")}
          onUpload={() => goToNewLecture("upload")}
          onDeleteNote={openDeleteConfirm as never}
          onArchiveNote={archiveNote as never}
          onRestoreNote={restoreNote as never}
          onRenameNote={openRename as never}
        />
      )
    }

    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass(MODULE_ID))} />
      </div>
    )
  }

  if (isNativeApp) {
    return (
      <>
        <NotetakerNativeHome
          q={q}
          onSearchChange={setQ}
          limits={limits}
          usage={usage}
          pctUsed={pctUsed}
          tierBlockedMessage={tierBlockedMessage}
          notes={visibleNotes}
          notesLoading={notesLoading}
          hasLoadedOnce={hasLoadedOnceRef.current}
          creatingMode={creatingMode}
          deletingId={deletingId}
          navPath={navPath}
          noteHref={noteHref}
          showArchived={showArchived}
          archivedCount={archivedCount}
          onToggleArchived={() =>
            setBrowseFilter((prev) => (prev === "archived" ? "all" : "archived"))
          }
          onRecord={() => {
            setCreatingMode("record")
            goToNewLecture("record")
          }}
          onUpload={() => {
            setCreatingMode("upload")
            goToNewLecture("upload")
          }}
          onDeleteNote={openDeleteConfirm as never}
          onArchiveNote={archiveNote as never}
          onRestoreNote={restoreNote as never}
          onRenameNote={openRename as never}
        />

        {listDialogs}
      </>
    )
  }

  const browseItems = [
    { id: "all" as const, label: "All lectures", icon: Mic, badge: activeCount },
    { id: "ready" as const, label: "Ready", icon: CheckCircle2, badge: readyCount },
    { id: "processing" as const, label: "Processing", icon: Clock, badge: processingCount },
    { id: "archived" as const, label: "Archived", icon: Archive, badge: archivedCount },
  ]

  return (
    <div data-notetaker-native-root className="space-y-3 min-w-0">
      <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
        <FacultyIntegratedToolbar
          embedded
          moduleId={MODULE_ID}
          search={q}
          onSearchChange={setQ}
          onSearchClear={() => setQ("")}
          searchPlaceholder="Search lecture notes…"
          filters={
            <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(sort !== "recent")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
          }
          meta={
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {tierBlockedMessage
                ? "Membership required for AI Notetaker"
                : `${visibleNotes.length} shown · ${activeCount} active · ${archivedCount} archived`}
              {limits && usage
                ? ` · ${usage.transcriptionMinutesUsed}/${limits.transcriptionMinutes} min used`
                : ""}
            </p>
          }
          trailing={
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-full border shadow-none hover:opacity-90"
                style={{
                  backgroundColor: ROLES.upload.fill,
                  color: ROLES.upload.icon,
                  borderColor: ROLES.upload.border,
                }}
                disabled={creatingMode !== null || !!tierBlockedMessage}
                onClick={() => {
                  setCreatingMode("upload")
                  goToNewLecture("upload")
                }}
              >
                {creatingMode === "upload" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Upload</span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-full border-0 text-white shadow-sm hover:opacity-90"
                style={{ backgroundColor: ROLES.record.fill, color: ROLES.record.icon }}
                disabled={creatingMode !== null || !!tierBlockedMessage}
                onClick={() => {
                  setCreatingMode("record")
                  goToNewLecture("record")
                }}
              >
                {creatingMode === "record" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" fill="currentColor" />
                )}
                <span className="hidden sm:inline">Record</span>
              </Button>
            </div>
          }
        />

        <FacultyModuleSplitLayout
          className="gap-2 border-t border-[var(--border)] pt-2 sm:gap-3 sm:pt-3 lg:gap-4"
          menuWidthClass="lg:w-56"
          menu={
            <div className="space-y-3 lg:border-r lg:border-[var(--border)] lg:pr-4">
              <FacultyModuleSideMenu
                embedded
                moduleId={MODULE_ID}
                accent={{ soft: ROLES.browse.soft, ink: ROLES.browse.ink }}
                title="Browse"
                activeId={browseFilter}
                onSelect={(id) => setBrowseFilter(id as BrowseFilter)}
                items={browseItems}
              />

              {limits && usage && !tierBlockedMessage ? (
                <div
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: ROLES.browse.soft, color: ROLES.browse.ink }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-xl"
                      style={{ backgroundColor: ROLES.record.fill, color: ROLES.record.icon }}
                    >
                      <Sparkles className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Plan</p>
                      <p className="truncate text-sm font-semibold">{limits.tier}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[11px] opacity-80">
                      <span>Transcription</span>
                      <span>
                        {usage.transcriptionMinutesUsed}/{limits.transcriptionMinutes} min
                      </span>
                    </div>
                    <Progress value={pctUsed} className="h-1.5 bg-black/10 dark:bg-white/15" />
                    <p className="text-[11px] opacity-75">
                      {usage.notesThisMonth}/{limits.maxNotesPerMonth} notes · up to{" "}
                      {limits.maxNoteDurationMinutes} min each
                    </p>
                    {!limits.chatEnabled ? (
                      <Link
                        href={navPath("/student/dashboard-v2/membership")}
                        className="inline-block text-[11px] font-semibold underline underline-offset-2"
                        style={{ color: ROLES.link }}
                      >
                        Upgrade for AI chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="min-w-0 space-y-3">
            {tierBlockedMessage ? (
              <div
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: ROLES.empty.fill, color: ROLES.empty.icon }}
              >
                <h2 className="text-base font-semibold text-[var(--cc-text)]">Membership required</h2>
                <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{tierBlockedMessage}</p>
                <Button
                  asChild
                  className="mt-4 rounded-full border-0 text-white hover:opacity-90"
                  style={{ backgroundColor: ROLES.record.fill }}
                >
                  <Link href={navPath("/student/dashboard-v2/membership")}>View membership options</Link>
                </Button>
              </div>
            ) : notesLoading && !hasLoadedOnceRef.current ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass(MODULE_ID))} />
              </div>
            ) : visibleNotes.length === 0 ? (
              <div
                className="flex flex-col items-center gap-4 rounded-2xl px-4 py-12 text-center"
                style={{ backgroundColor: ROLES.empty.fill }}
              >
                <span
                  className="flex size-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: ROLES.record.fill, color: ROLES.record.icon }}
                >
                  <Mic className="h-7 w-7" />
                </span>
                <div className="max-w-sm space-y-1.5">
                  <p className="text-base font-semibold text-[var(--cc-text)]">
                    {showArchived ? "No archived lectures" : "Capture your next lecture"}
                  </p>
                  <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
                    {showArchived
                      ? "Archived notes stay on this browser until you restore or delete them."
                      : "Record live or upload audio — we transcribe and summarize into a study-ready note."}
                  </p>
                </div>
                {!showArchived ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      className="gap-2 rounded-full border-0 text-white hover:opacity-90"
                      style={{ backgroundColor: ROLES.record.fill, color: ROLES.record.icon }}
                      onClick={() => goToNewLecture("record")}
                    >
                      <Mic className="h-4 w-4" />
                      Record
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 rounded-full border"
                      style={{
                        backgroundColor: ROLES.upload.fill,
                        color: ROLES.upload.icon,
                        borderColor: ROLES.upload.border,
                      }}
                      onClick={() => goToNewLecture("upload")}
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {notesLoading && hasLoadedOnceRef.current ? (
                  <li className={cn("flex items-center gap-2 px-1 text-xs", PORTAL_TEXT_MUTED)}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ROLES.link }} />
                    Updating…
                  </li>
                ) : null}
                {visibleNotes.map((n, index) => {
                  const statusThumb = notetakerStatusThumb(chrome, n.processing_status)
                  const thumb =
                    browseFilter === "archived"
                      ? ROLES.archived
                      : notetakerListThumbAt(chrome, index)
                  const Icon = noteListIcon(n.processing_status)
                  return (
                    <li key={n.id}>
                      <MaterialInteractiveSurface
                        className={cn(
                          materialSurfaceClass,
                          "flex items-center gap-2 rounded-2xl bg-[var(--cc-surface,#F4F6F8)] px-2.5 py-2.5 shadow-sm dark:bg-white/[0.09] dark:shadow-none sm:gap-3 sm:px-3",
                        )}
                        style={{ ["--material-ink" as string]: thumb.fill }}
                      >
                        <Link href={noteHref(n)} className="flex min-w-0 flex-1 items-center gap-3">
                          <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{n.title}</p>
                            <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                              {[n.course_name, n.lecture_date].filter(Boolean).join(" · ") || "No course set"}
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                                style={{
                                  backgroundColor: statusThumb.fill,
                                  color: statusThumb.icon,
                                }}
                              >
                                {n.processing_status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            title="Rename"
                            onClick={(e) => openRename(n, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {showArchived ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full"
                              title="Restore"
                              onClick={(e) => restoreNote(n, e)}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full"
                              title="Archive on this device"
                              onClick={(e) => archiveNote(n, e)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                            title="Delete note"
                            disabled={deletingId === n.id}
                            onClick={(e) => openDeleteConfirm(n, e)}
                          >
                            {deletingId === n.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </MaterialInteractiveSurface>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </FacultyModuleSplitLayout>
      </div>

      {listDialogs}
    </div>
  )
}

