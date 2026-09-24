"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"

type LiveActivityRow = {
  id: number
  createdAt: string
  courseId: number | null
  assignmentId: number | null
  liveSessionId: number | null
  studentId: number | null
  studentName: string | null
  actor: string
  eventType: string
  ok: boolean | null
  httpStatus: number | null
  message: string | null
  codeExcerpt: string | null
  codeChars: number | null
  rosterStatus: string | null
  detail: Record<string, unknown> | null
}

const EVENT_NOTES: Record<string, string> = {
  editor_joined:
    "The student asked to join. HTTP 200 means the classroom accepted them. The instructor roster should show Joined until they type or compile.",
  editor_left: "The student left the editor. The instructor roster should drop them from Joined.",
  session_visible: "The student app can see this live session and is allowed to join it.",
  session_hidden: "The student app could not match their section to the open session, so Join is hidden.",
  snapshot_ok: "The student editor saved or sent a heartbeat. HTTP 200 means the database accepted that copy.",
  snapshot_fail: "The student editor tried to save and the database rejected it.",
  snapshot_denied: "The classroom refused the save. The HTTP status is why (closed session, wrong section, or not allowed).",
  roster_status:
    "This row is the instructor poll, not a student request, so there is no student HTTP status. The roster status is what the instructor list showed for this student.",
  instructor_edit: "The instructor sent an edited copy. That copy is stored separately and does not replace the student's own file.",
  student_sync_requested: "The instructor asked the student editor to upload the file it currently has.",
  compiler_error: "The student's compiler ran and reported an error.",
  compiler_ready: "The student's compiler is installed and the compile succeeded.",
  run: "The student ran the program.",
  runtime_exit: "The program compiled, then exited with a failure.",
}

const DETAIL_LABELS: Record<string, string> = {
  intent: "Student request",
  httpStatus: "HTTP status",
  instructorRosterStatus: "Status the instructor should show",
  rosterStatus: "Roster status",
  instructorSeesStudent: "Instructor list includes this student",
  source: "Recorded from",
  fileName: "File",
  language: "Language",
  cursorLine: "Cursor line",
  cursorColumn: "Cursor column",
  studentCodeChars: "Student code length",
  keptPreviousCode: "Kept the saved copy (incoming edit looked like a reset)",
  editorStillOpen: "Editor still open",
  feature: "Feature",
  revision: "Instructor revision",
  instructorCodeChars: "Instructor edit length",
  studentCodeUntouched: "Student file left unchanged",
  studioEvent: "Compiler event",
  compilerInstalled: "Compiler installed",
  errorMessage: "Compiler message",
  accepted: "Request accepted",
  requestedAt: "Sync requested at",
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDetailValue(value: unknown): string {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function LiveLogDrawer({ row, onClose }: { row: LiveActivityRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const detailEntries = Object.entries(row.detail ?? {})
  const note = EVENT_NOTES[row.eventType] ?? "Recorded live-classroom event."

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        key="live-log-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="Close log details"
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]"
      />
      <motion.aside
        key="live-log-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className="fixed right-0 top-16 z-[70] flex h-[calc(100vh-4rem)] w-full flex-col bg-[var(--card)] shadow-2xl md:w-[min(100%,28rem)] lg:w-[min(100%,32rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Live classroom log
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-[var(--cc-text)]">
                {row.studentName ?? (row.studentId ? `Student ${row.studentId}` : row.actor)}
              </h2>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                {row.eventType}
                {row.rosterStatus ? ` · ${row.rosterStatus}` : ""} · {formatWhen(row.createdAt)}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-[var(--cc-text)]">{note}</p>
          <dl className="space-y-2 text-xs">
            <DetailLine label="Result" value={row.ok == null ? "—" : row.ok ? "Succeeded" : "Failed"} />
            <DetailLine
              label="HTTP status"
              value={row.httpStatus != null ? String(row.httpStatus) : "None — this row is not a student HTTP request"}
            />
            <DetailLine label="Roster status" value={row.rosterStatus ?? "—"} />
            <DetailLine label="Message" value={row.message ?? "—"} />
            <DetailLine label="Code length" value={row.codeChars != null ? `${row.codeChars} characters` : "—"} />
            <DetailLine label="Actor" value={row.actor} />
            <DetailLine label="Assignment" value={row.assignmentId != null ? String(row.assignmentId) : "—"} />
            <DetailLine label="Live session" value={row.liveSessionId != null ? String(row.liveSessionId) : "—"} />
            {detailEntries.map(([key, value]) => (
              <DetailLine key={key} label={DETAIL_LABELS[key] ?? key} value={formatDetailValue(value)} />
            ))}
          </dl>
          {row.codeExcerpt ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                Code recorded with this event
              </p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--muted)]/50 p-3 font-mono text-[11px] text-[var(--cc-text)]">
                {row.codeExcerpt}
              </pre>
            </div>
          ) : null}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5">
      <dt className="text-[var(--cc-text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--cc-text)]">{value}</dd>
    </div>
  )
}

export function InstructorLiveClassroomDebugLog() {
  const scopeKey = useInstructorScopeKey()
  const [rows, setRows] = useState<LiveActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await instructorApiFetch("/api/instructor/codebench/live-activity?limit=200")
      const parsed = await readInstructorApiJson<{ events?: LiveActivityRow[]; error?: string }>(
        res,
        "Live classroom log",
      )
      if (!parsed.ok) throw new Error(parsed.error)
      setRows(parsed.data.events ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the live classroom log.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, scopeKey])

  const selected = rows.find((row) => row.id === selectedId) ?? null

  return (
    <section className={cn(PORTAL_CARD, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Live classroom log</h3>
          <p className={cn("mt-1 max-w-2xl text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
            Open a row to see the join status, what the instructor roster showed, the code that was saved, compiler
            results, and instructor edits.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {loading && rows.length === 0 ? (
        <p className={cn("flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading log…
        </p>
      ) : rows.length === 0 ? (
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>No live classroom events for this course yet.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedId((current) => (current === row.id ? null : row.id))}
              className={cn(
                "w-full rounded-lg border border-[var(--border)] px-3 py-2 text-left",
                selectedId === row.id && "border-[var(--cc-accent)]",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn("text-xs font-medium", PORTAL_TEXT)}>
                  {row.studentName ?? (row.studentId ? `Student ${row.studentId}` : row.actor)} · {row.eventType}
                  {row.rosterStatus ? ` · ${row.rosterStatus}` : ""}
                </p>
                <span className={cn("text-[10px] tabular-nums", PORTAL_TEXT_MUTED)}>{formatWhen(row.createdAt)}</span>
              </div>
              <p className={cn("mt-1 text-[11px]", row.ok === false ? "text-red-600 dark:text-red-300" : PORTAL_TEXT_MUTED)}>
                {row.httpStatus != null ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                {row.message ? ` · ${row.message}` : ""}
                {row.codeChars != null ? ` · ${row.codeChars} chars` : ""}
              </p>
            </button>
          ))}
        </div>
      )}
      {selected ? <LiveLogDrawer row={selected} onClose={() => setSelectedId(null)} /> : null}
    </section>
  )
}
