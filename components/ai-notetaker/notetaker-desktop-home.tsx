"use client"

import { Suspense, type MouseEvent } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { DesktopChromeTitle } from "@/components/desktop/DesktopLangSmithChrome"
import { NotetakerNewSession } from "@/components/ai-notetaker/notetaker-new-session"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"
import type { NotetakerChrome } from "@/lib/notetaker-list-theme"
import { notetakerListThumbAt, notetakerStatusThumb } from "@/lib/notetaker-list-theme"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export type DesktopNoteRow = {
  id: number
  slug?: string
  title: string
  course_name: string | null
  lecture_date: string | null
  processing_status: string
  duration_seconds?: number | null
  created_at?: string
}

type LimitsPayload = {
  tier: string
  maxNoteDurationMinutes: number
  transcriptionMinutes: number
  maxNotesPerMonth: number
  chatEnabled: boolean
}

type BrowseFilter = "all" | "ready" | "processing" | "archived"
type NoteSort = "recent" | "title"

type Props = {
  chrome: NotetakerChrome
  q: string
  onSearchChange: (value: string) => void
  sort: NoteSort
  onSortChange: (value: NoteSort) => void
  browseFilter: BrowseFilter
  onBrowseChange: (value: BrowseFilter) => void
  counts: { all: number; ready: number; processing: number; archived: number }
  limits: LimitsPayload | null
  usage: { notesThisMonth: number; transcriptionMinutesUsed: number } | null
  tierBlockedMessage: string | null
  notes: DesktopNoteRow[]
  notesLoading: boolean
  hasLoadedOnce: boolean
  creatingMode: "record" | "upload" | null
  deletingId: number | null
  navPath: (path: string) => string
  noteHref: (note: Pick<DesktopNoteRow, "id" | "slug">) => string
  onRecord: () => void
  onUpload: () => void
  sessionMode?: "record" | "upload" | null
  onBackToList?: () => void
  onDeleteNote: (note: DesktopNoteRow, e: MouseEvent) => void
  onArchiveNote: (note: DesktopNoteRow, e: MouseEvent) => void
  onRestoreNote: (note: DesktopNoteRow, e: MouseEvent) => void
  onRenameNote: (note: DesktopNoteRow, e: MouseEvent) => void
}

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

export function NotetakerDesktopHome({
  chrome,
  q,
  onSearchChange,
  sort,
  onSortChange,
  browseFilter,
  onBrowseChange,
  counts,
  limits,
  usage,
  tierBlockedMessage,
  notes,
  notesLoading,
  hasLoadedOnce,
  creatingMode,
  deletingId,
  navPath,
  noteHref,
  onRecord,
  onUpload,
  sessionMode,
  onBackToList,
  onDeleteNote,
  onArchiveNote,
  onRestoreNote,
  onRenameNote,
}: Props) {
  const { roles: ROLES } = chrome
  const showArchived = browseFilter === "archived"
  const pctUsed =
    limits && usage
      ? Math.min(100, (usage.transcriptionMinutesUsed / Math.max(1, limits.transcriptionMinutes)) * 100)
      : 0
  const meta = tierBlockedMessage
    ? "Membership required"
    : [
        `${notes.length} shown`,
        `${counts.all} active`,
        `${counts.archived} archived`,
        limits && usage
          ? `${usage.transcriptionMinutesUsed}/${limits.transcriptionMinutes} min used`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")

  const browseItems = [
    { id: "all" as const, label: "All lectures", icon: Mic, badge: counts.all },
    { id: "ready" as const, label: "Ready", icon: CheckCircle2, badge: counts.ready },
    { id: "processing" as const, label: "Processing", icon: Clock, badge: counts.processing },
    { id: "archived" as const, label: "Archived", icon: Archive, badge: counts.archived },
  ]

  const chromeSlots = (
    <DesktopChromeTitle>
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="shrink-0 truncate text-[16px] font-semibold tracking-tight">AI Notetaker</h1>
        <span className="shrink-0 text-[12px] text-[#6b7280] dark:text-[#9ca3af]" aria-hidden>
          ·
        </span>
        <p className="min-w-0 truncate text-[12px] leading-4 text-[#6b7280] dark:text-[#9ca3af]">{meta}</p>
      </div>
    </DesktopChromeTitle>
  )

  if (notesLoading && !hasLoadedOnce) {
    return (
      <>
        {chromeSlots}
        <ModuleListSkeleton rows={7} className="min-h-[50vh] p-1" />
      </>
    )
  }

  return (
    <div
      data-desktop-notetaker-workspace
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4"
    >
      {chromeSlots}
      {sessionMode ? null : (
      <FacultyIntegratedToolbar
        embedded
        moduleId="ai-notetaker"
        search={q}
        onSearchChange={onSearchChange}
        onSearchClear={() => onSearchChange("")}
        searchPlaceholder="Search lecture notes…"
        filters={
          <Select value={sort} onValueChange={(value) => onSortChange(value as NoteSort)}>
            <SelectTrigger className={facultyToolbarSelectTriggerClass(sort !== "recent")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
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
              onClick={onUpload}
            >
              {creatingMode === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">Upload</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 rounded-full border-0 text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: ROLES.record.fill, color: ROLES.record.icon }}
              disabled={creatingMode !== null || !!tierBlockedMessage}
              onClick={onRecord}
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
      )}

      <FacultyModuleSplitLayout
        className={cn("min-h-0 flex-1 gap-3", sessionMode && "border-0 pt-0")}
        menuWidthClass="lg:w-56"
        menu={
          <div className="flex h-full min-h-0 flex-col gap-3 lg:border-r lg:border-[var(--border)] lg:pr-4">
            <FacultyModuleSideMenu
              embedded
              moduleId="ai-notetaker"
              accent={{ soft: ROLES.browse.soft, ink: ROLES.browse.ink }}
              title="Browse"
              activeId={browseFilter}
              onSelect={(id) => {
                if (sessionMode) onBackToList?.()
                onBrowseChange(id as BrowseFilter)
              }}
              items={browseItems}
            />
            {limits && usage && !tierBlockedMessage ? (
              <div
                className="mt-auto rounded-2xl p-3"
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
                    {usage.notesThisMonth}/{limits.maxNotesPerMonth} notes · up to {limits.maxNoteDurationMinutes}{" "}
                    min each
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {sessionMode ? (
            <Suspense
              fallback={
                <div className="flex min-h-full flex-1 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
                </div>
              }
            >
              <NotetakerNewSession embedded captureMode={sessionMode} onBack={onBackToList} />
            </Suspense>
          ) : tierBlockedMessage ? (
            <div
              className="flex min-h-full flex-1 flex-col items-center justify-center rounded-2xl p-6 text-center"
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
          ) : notes.length === 0 ? (
            <div
              className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 rounded-2xl px-4 py-12 text-center"
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
                    : "Record live or upload audio from the toolbar — we transcribe and summarize into a study-ready note."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {notesLoading ? (
                <li className={cn("flex items-center gap-2 px-1 text-xs", PORTAL_TEXT_MUTED)}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ROLES.link }} />
                  Updating…
                </li>
              ) : null}
              {notes.map((note, index) => {
                const statusThumb = notetakerStatusThumb(chrome, note.processing_status)
                const thumb =
                  browseFilter === "archived" ? ROLES.archived : notetakerListThumbAt(chrome, index)
                const Icon = noteListIcon(note.processing_status)
                return (
                  <li key={note.id}>
                    <MaterialInteractiveSurface
                      className={cn(
                        materialSurfaceClass,
                        "flex items-center gap-2 rounded-2xl bg-[var(--cc-surface,#F4F6F8)] px-2.5 py-2.5 shadow-sm dark:bg-white/[0.09] dark:shadow-none sm:gap-3 sm:px-3",
                      )}
                      style={{ ["--material-ink" as string]: thumb.fill }}
                    >
                      <Link href={noteHref(note)} className="flex min-w-0 flex-1 items-center gap-3">
                        <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{note.title}</p>
                          <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                            {[note.course_name, note.lecture_date].filter(Boolean).join(" · ") || "No course set"}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                              style={{
                                backgroundColor: statusThumb.fill,
                                color: statusThumb.icon,
                              }}
                            >
                              {note.processing_status.replace(/_/g, " ")}
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
                          onClick={(event) => onRenameNote(note, event)}
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
                            onClick={(event) => onRestoreNote(note, event)}
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
                            onClick={(event) => onArchiveNote(note, event)}
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
                          disabled={deletingId === note.id}
                          onClick={(event) => onDeleteNote(note, event)}
                        >
                          {deletingId === note.id ? (
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
  )
}
