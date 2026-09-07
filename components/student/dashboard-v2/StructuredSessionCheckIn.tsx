"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { formatTime12h } from "@/lib/schedule-adjustment/time-slots"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type SessionPayload = {
  id: number
  class_title?: string
  section?: string
  start_time?: string
  end_time?: string
  my_status?: string | null
  my_checkin?: string | null
}

function clock(value?: string | null) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return formatTime12h(String(value))
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
}

export function StructuredSessionCheckIn({ onRecorded }: { onRecorded?: () => void }) {
  const { toast } = useToast()
  const theme = getStudentModuleTheme("attendance")
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ status: string; checkedInLocal?: string } | null>(null)

  const load = useCallback(async () => {
    const student = getStudentData()
    if (!student?.databaseId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await studentApiFetch(
        `/api/student/attendance/structured-today?studentId=${encodeURIComponent(student.databaseId)}`,
      )
      const data = await res.json()
      const row = (data.session ?? null) as SessionPayload | null
      setSession(row)
      if (row?.my_status) {
        setResult({ status: row.my_status, checkedInLocal: clock(row.my_checkin) })
      } else {
        setResult(null)
      }
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || !session) return null

  const checkIn = async () => {
    const student = getStudentData()
    if (!student?.databaseId) return
    setSaving(true)
    try {
      const res = await studentApiFetch("/api/student/attendance/self-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.databaseId, sessionId: session.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Check-in failed")
      setResult({ status: data.status, checkedInLocal: data.checkedInLocal })
      toast({
        title: data.alreadyRecorded ? "Already checked in" : "Attendance recorded",
        description: data.sessionTitle ?? session.class_title ?? "Structured CourseCollab Session",
      })
      onRecorded?.()
      await load()
    } catch (error) {
      toast({
        title: "Check-in failed",
        description: error instanceof Error ? error.message : "Try again during the session window.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        PORTAL_CARD,
        "overflow-hidden border-[color-mix(in_srgb,var(--cc-accent)_24%,var(--border))]",
      )}
    >
      <div className="border-b border-[var(--border)] bg-[var(--cc-accent-soft)]/35 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-xl p-2", theme.page.iconBg, theme.page.iconText)}>
            <CalendarCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Structured CourseCollab Session
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--cc-text)]">
              {session.section ?? session.class_title}
            </p>
            <p className="text-xs text-[var(--cc-text-muted)]">
              Today · {clock(session.start_time)} to {clock(session.end_time)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        {result ? (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Attendance recorded</p>
              <p className="mt-0.5 capitalize text-[var(--cc-text-muted)]">Status: {result.status}</p>
              {result.checkedInLocal ? (
                <p className="text-[var(--cc-text-muted)]">Checked in: {result.checkedInLocal}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--cc-text-muted)]">
              Tap check in during your structured session window.
            </p>
            <Button
              disabled={saving}
              className="h-10 shrink-0 rounded-xl border-0 shadow-none hover:opacity-90"
              style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
              onClick={() => void checkIn()}
            >
              {saving ? "Checking in…" : "Check in now"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
