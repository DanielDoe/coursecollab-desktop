"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpRight, Code2, Loader2, Radio, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useInstructorClassroomAssignments } from "@/hooks/use-instructor-classroom-assignments"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import { useInstructorLiveClassroomSessions } from "@/hooks/use-instructor-live-classroom-sessions"
import {
  classroomAssignmentToHandoff,
  classroomAssignmentTopic,
  extractClassroomQuestionText,
  groupClassroomAssignmentsBySession,
  type InstructorClassroomHandoff,
} from "@/lib/codebench-instructor-classroom"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  onStartLiveSession: (handoff: InstructorClassroomHandoff) => void
  onOpenClassroomInIde: (handoff: InstructorClassroomHandoff) => void
  onOpenChallenges?: () => void
}

function questionPreview(text: string, max = 140) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).trim()}…`
}

export function InstructorCodebenchLivePanel({
  onStartLiveSession,
  onOpenClassroomInIde,
  onOpenChallenges,
}: Props) {
  const chrome = facultyEmbedChrome("codebench")
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const sessionFilter = useMemo(() => defaultFacultySessionFilter(), [courseScopeVersion])
  const { submissions, loading, error, reload } = useInstructorClassroomAssignments(sessionFilter)
  const {
    sessions: openSessions,
    loading: sessionsLoading,
    reload: reloadSessions,
  } = useInstructorLiveClassroomSessions()
  const [startingId, setStartingId] = useState<number | null>(null)

  const activeCodeChallenges = useMemo(
    () =>
      submissions.filter(
        (row) =>
          row.is_active &&
          String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase() ===
            CLASSROOM_SUBMISSION_KIND_CODE,
      ),
    [submissions],
  )

  const grouped = useMemo(
    () => groupClassroomAssignmentsBySession(activeCodeChallenges),
    [activeCodeChallenges],
  )

  const liveAssignmentIds = useMemo(
    () => new Set(openSessions.map((session) => session.assignmentId)),
    [openSessions],
  )

  const handleRefresh = () => {
    void reload()
    void reloadSessions()
  }

  const handleStart = async (handoff: InstructorClassroomHandoff) => {
    setStartingId(handoff.submissionId)
    try {
      const response = await instructorApiFetch("/api/instructor/codebench/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: handoff.submissionId }),
      })
      if (response.status !== 404 && response.status !== 405) {
        const parsed = await readInstructorApiJson(response, "Start live session")
        if (!parsed.ok) throw new Error(parsed.error)
        void reloadSessions(true)
      }
      onStartLiveSession(handoff)
    } catch (err) {
      toast({
        title: "Could not start live session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div className="instructor-challenges-panel flex min-h-0 w-full flex-col gap-4 pr-1">
      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
              <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Live Coding Classroom</h2>
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              Start a live session so students can join from CodeBench. Their editor opens on this assignment and you
              can watch keystrokes, compile errors, and submissions.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleRefresh} disabled={loading || sessionsLoading}>
            {loading || sessionsLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        <ol className={cn("instructor-steps-grid text-xs", PORTAL_TEXT_MUTED)}>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">1. Start</span> — students see the session in CodeBench
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">2. Students join</span> — their editor opens on this assignment
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">3. Monitor</span> — watch live code and keystroke replay
          </li>
        </ol>
      </div>

      {error ? (
        <div className={cn(chrome.card, "p-4 text-sm text-red-600 dark:text-red-400")}>{error}</div>
      ) : loading ? (
        <div className={cn(chrome.card, "flex items-center gap-2 p-6 text-sm", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading active challenges…
        </div>
      ) : grouped.length === 0 ? (
        <div className={cn(chrome.card, "space-y-3 p-6 text-center")}>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No active coding challenges</p>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            Publish a coding challenge first, then return here to demo it live in the IDE.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {onOpenChallenges ? (
              <Button type="button" size="sm" onClick={onOpenChallenges}>
                Create a challenge
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/faculty/dashboard/assessments/classroom-points">
                Open Classroom Points
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        grouped.map(([session, rows]) => (
          <section key={session} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{session}</h3>
              <Badge variant="outline" className="text-[10px]">
                {rows.filter((row) => liveAssignmentIds.has(row.id)).length || rows.length}{" "}
                {rows.some((row) => liveAssignmentIds.has(row.id)) ? "live" : "ready"}
              </Badge>
            </div>
            <div className="instructor-challenges-grid grid grid-cols-1 gap-3">
              {rows.map((row) => {
                const handoff = classroomAssignmentToHandoff(row)
                const preview = questionPreview(extractClassroomQuestionText(row))
                const isLive = liveAssignmentIds.has(row.id)
                const starting = startingId === row.id
                return (
                  <article key={row.id} className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>{row.title}</p>
                        <p className={cn("line-clamp-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{preview}</p>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] text-[var(--cc-accent)]">
                        <Code2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isLive ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Live now
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Ready
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {classroomAssignmentTopic(row)}
                      </Badge>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void handleStart(handoff)} disabled={starting}>
                        {starting ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Radio className="mr-1 h-3.5 w-3.5" />
                        )}
                        {isLive ? "Open live session" : "Start live session"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onOpenClassroomInIde(handoff)}>
                        Open in IDE
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
