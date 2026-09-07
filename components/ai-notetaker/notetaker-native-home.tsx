"use client"

import type { MouseEvent } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Loader2,
  Mic,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type NoteRow = {
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

type Props = {
  q: string
  onSearchChange: (value: string) => void
  limits: LimitsPayload | null
  usage: { notesThisMonth: number; transcriptionMinutesUsed: number } | null
  pctUsed: number
  tierBlockedMessage: string | null
  notes: NoteRow[]
  notesLoading: boolean
  hasLoadedOnce: boolean
  creatingMode: "record" | "upload" | null
  deletingId: number | null
  navPath: (path: string) => string
  noteHref: (note: Pick<NoteRow, "id" | "slug">) => string
  showArchived: boolean
  archivedCount: number
  onToggleArchived: () => void
  onRecord: () => void
  onUpload: () => void
  onDeleteNote: (note: NoteRow, e: MouseEvent) => void
  onArchiveNote: (note: NoteRow, e: MouseEvent) => void
  onRestoreNote: (note: NoteRow, e: MouseEvent) => void
  onRenameNote: (note: NoteRow, e: MouseEvent) => void
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ")
}

export function NotetakerNativeHome({
  q,
  onSearchChange,
  limits,
  usage,
  pctUsed,
  tierBlockedMessage,
  notes,
  notesLoading,
  hasLoadedOnce,
  creatingMode,
  deletingId,
  navPath,
  noteHref,
  showArchived,
  archivedCount,
  onToggleArchived,
  onRecord,
  onUpload,
  onDeleteNote,
  onArchiveNote,
  onRestoreNote,
  onRenameNote,
}: Props) {
  return (
    <div data-notetaker-native-root data-notetaker-native-layout className="cc-native-notetaker">
      <div className="cc-native-search-row">
        <Search className="cc-native-search-icon" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search lecture notes…"
          disabled={!!tierBlockedMessage}
          className="cc-native-search-input"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {tierBlockedMessage ? (
        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Membership</h2>
          <div className="cc-native-group">
            <div className="cc-native-panel">
              <p className="cc-native-panel-title">Upgrade required</p>
              <p className="cc-native-panel-body">{tierBlockedMessage}</p>
              <Link href={navPath("/student/dashboard-v2/membership")} className="cc-native-link-row">
                View membership options
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {!tierBlockedMessage && limits && usage ? (
        <section className="cc-native-section">
          <h2 className="cc-native-section-header">Your Plan</h2>
          <div className="cc-native-group">
            <div className="cc-native-panel">
              <p className="cc-native-panel-title">{limits.tier}</p>
              <p className="cc-native-panel-body">
                Up to {limits.maxNoteDurationMinutes} min per lecture · ~
                {limits.transcriptionMinutes} transcription min / month · {usage.notesThisMonth} /{" "}
                {limits.maxNotesPerMonth} notes this month
                {!limits.chatEnabled ? " · AI chat requires Trailblazer" : ""}
              </p>
              <div className="cc-native-progress-block">
                <div className="cc-native-progress-meta">
                  <span>Transcription used</span>
                  <span>
                    {usage.transcriptionMinutesUsed} / {limits.transcriptionMinutes} min
                  </span>
                </div>
                <Progress value={pctUsed} className="cc-native-progress h-1.5" />
              </div>
              {!limits.chatEnabled ? (
                <Link href={navPath("/student/dashboard-v2/membership")} className="cc-native-link-row">
                  Upgrade for AI chat with notes
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="cc-native-section">
        <h2 className="cc-native-section-header">Capture</h2>
        <div className="cc-native-group">
          <button
            type="button"
            className="cc-native-row cc-native-row-primary"
            onClick={onRecord}
            disabled={creatingMode !== null || !!tierBlockedMessage}
          >
            <span className="cc-native-icon-tile cc-native-icon-tile-accent">
              {creatingMode === "record" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </span>
            <span className="cc-native-row-copy">
              <span className="cc-native-row-title">Record new lecture</span>
              <span className="cc-native-row-subtitle">Start a live capture session</span>
            </span>
            <ChevronRight className="cc-native-row-chevron" aria-hidden />
          </button>
          <button
            type="button"
            className="cc-native-row cc-native-row-last"
            onClick={onUpload}
            disabled={creatingMode !== null || !!tierBlockedMessage}
          >
            <span className="cc-native-icon-tile">
              {creatingMode === "upload" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </span>
            <span className="cc-native-row-copy">
              <span className="cc-native-row-title">Upload audio</span>
              <span className="cc-native-row-subtitle">Import an existing recording</span>
            </span>
            <ChevronRight className="cc-native-row-chevron" aria-hidden />
          </button>
        </div>
      </section>

      <section className="cc-native-section">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="cc-native-section-header mb-0">
            {showArchived ? "Archived Notes" : "Recent Lecture Notes"}
          </h2>
          {archivedCount > 0 || showArchived ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 rounded-full px-2 text-xs"
              onClick={onToggleArchived}
            >
              {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {showArchived ? "Active" : `Archive (${archivedCount})`}
            </Button>
          ) : null}
        </div>
        <div className="cc-native-group">
          {tierBlockedMessage ? (
            <p className="cc-native-empty">Upgrade to see your lecture notes here.</p>
          ) : notesLoading && !hasLoadedOnce ? (
            <NativeNotesSkeleton />
          ) : notes.length === 0 ? (
            <div className="cc-native-empty-block">
              <span className="cc-native-icon-tile cc-native-icon-tile-accent cc-native-empty-icon">
                <Mic className="h-5 w-5" />
              </span>
              <p className="cc-native-empty-title">
                {showArchived ? "No archived notes" : "No lecture notes yet"}
              </p>
              <p className="cc-native-empty-body">
                {showArchived
                  ? "Archived notes stay on this device until you restore or delete them."
                  : "Record or upload audio — we transcribe and summarize when you finish."}
              </p>
            </div>
          ) : (
            <>
              {notesLoading && hasLoadedOnce ? (
                <div className="cc-native-inline-status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating…
                </div>
              ) : null}
              <ul className="cc-native-list">
                {notes.map((note, index) => (
                  <li
                    key={note.id}
                    className={cn("cc-native-note-item", index === notes.length - 1 && "cc-native-note-item-last")}
                  >
                    <Link href={noteHref(note)} className="cc-native-row cc-native-note-link">
                      <span className="cc-native-icon-tile cc-native-icon-tile-accent">
                        <Mic className="h-4 w-4" />
                      </span>
                      <span className="cc-native-row-copy">
                        <span className="cc-native-row-title truncate">{note.title}</span>
                        <span className="cc-native-row-subtitle truncate">
                          {[note.course_name, note.lecture_date].filter(Boolean).join(" · ") || "No course set"}
                        </span>
                      </span>
                      <span className="cc-native-status-pill">{statusLabel(note.processing_status)}</span>
                      <ChevronRight className="cc-native-row-chevron" aria-hidden />
                    </Link>
                    <button
                      type="button"
                      className="cc-native-note-delete"
                      title="Rename"
                      onClick={(e) => onRenameNote(note, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="cc-native-note-delete"
                      title={showArchived ? "Restore" : "Archive"}
                      onClick={(e) => (showArchived ? onRestoreNote(note, e) : onArchiveNote(note, e))}
                    >
                      {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className="cc-native-note-delete"
                      title="Delete note"
                      disabled={deletingId === note.id}
                      onClick={(e) => onDeleteNote(note, e)}
                    >
                      {deletingId === note.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function NativeNotesSkeleton() {
  return (
    <div className="cc-native-skeleton-list">
      {[1, 2, 3].map((i) => (
        <div key={i} className="cc-native-skeleton-row">
          <div className="cc-native-skeleton-tile" />
          <div className="cc-native-skeleton-copy">
            <div className="cc-native-skeleton-line cc-native-skeleton-line-wide" />
            <div className="cc-native-skeleton-line cc-native-skeleton-line-narrow" />
          </div>
        </div>
      ))}
    </div>
  )
}
