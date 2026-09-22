"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"

type LiveActivityRow = {
  id: number
  createdAt: string
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

export function InstructorLiveClassroomDebugLog() {
  const scopeKey = useInstructorScopeKey()
  const [rows, setRows] = useState<LiveActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <section className={cn(PORTAL_CARD, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Live classroom log</h3>
          <p className={cn("mt-1 max-w-2xl text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
            Whether each student could see the session, whether their code saved, the connection status, what they
            typed, what you edited, and how they appeared on the roster.
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
            <article key={row.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
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
              {row.codeExcerpt ? (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--muted)]/50 p-2 font-mono text-[10px] text-[var(--cc-text)]">
                  {row.codeExcerpt}
                </pre>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
