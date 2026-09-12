"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Code2,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { FacultySidebarPagination } from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import type {
  CodebenchRecentActivityItem,
  CodebenchStudentActivityPayload,
  CodebenchStudentActivityRow,
} from "@/lib/codebench-instructor-student-activity"
import { studioToolLabel } from "@/lib/codebench-studio-analytics"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { toast } from "@/lib/app-toast"

const STUDENTS_PER_PAGE = 20
const CLASSROOM_POINTS_HREF = "/faculty/dashboard/assessments/classroom-points"

function formatWhen(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function toneClass(tone: CodebenchRecentActivityItem["tone"]) {
  switch (tone) {
    case "error":
      return "border-red-500/30 bg-red-500/8 text-red-700 dark:text-red-300"
    case "ok":
      return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
    case "tool":
      return "border-[color-mix(in_srgb,var(--cc-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))] text-[var(--cc-accent)]"
    case "submit":
      return "border-blue-500/30 bg-blue-500/8 text-blue-700 dark:text-blue-300"
    default:
      return "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text-muted)]"
  }
}

export function InstructorCodebenchStudentActivityPanel() {
  const scopeKey = useInstructorScopeKey()
  const chrome = facultyEmbedChrome("codebench")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [payload, setPayload] = useState<CodebenchStudentActivityPayload | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "not_started">("all")
  const [windowDays, setWindowDays] = useState("30")
  const [studentsPage, setStudentsPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await instructorApiFetch(
        `/api/instructor/codebench/student-activity?days=${encodeURIComponent(windowDays)}`,
      )
      const parsed = await readInstructorApiJson<CodebenchStudentActivityPayload>(
        res,
        "CodeBench student activity",
      )
      if (!parsed.ok) throw new Error(parsed.error)
      setPayload(parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load student activity"
      setLoadError(message)
      toast.error(message)
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [windowDays])

  useEffect(() => {
    void load()
  }, [load, scopeKey])

  const rows = useMemo(() => {
    const students = payload?.students ?? []
    const q = search.trim().toLowerCase()
    return students.filter((row) => {
      if (filter === "active" && !row.engaged) return false
      if (filter === "not_started" && row.engaged) return false
      if (!q) return true
      return [row.fullName, row.studentId, row.email, row.section, row.sessionCode]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(q))
    })
  }, [filter, payload?.students, search])

  const totalStudentsPages = Math.max(1, Math.ceil(rows.length / STUDENTS_PER_PAGE))
  const paginatedRows = useMemo(() => {
    const start = (studentsPage - 1) * STUDENTS_PER_PAGE
    return rows.slice(start, start + STUDENTS_PER_PAGE)
  }, [rows, studentsPage])

  useEffect(() => {
    setStudentsPage(1)
  }, [search, filter, windowDays])

  useEffect(() => {
    if (studentsPage > totalStudentsPages) setStudentsPage(totalStudentsPages)
  }, [studentsPage, totalStudentsPages])

  const needsHelp = useMemo(
    () =>
      (payload?.students ?? []).filter(
        (row) => row.engaged && row.compileErrors > row.compileSuccesses && row.runs >= 2,
      ),
    [payload?.students],
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable] sm:pr-2">
      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
              <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Student CodeBench activity</h2>
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              See who ran code, used Cora tools, hit compile errors, and submitted assignments — scoped to your
              course and section filter.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger className="h-9 w-[130px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
              {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>
        <Link
          href={CLASSROOM_POINTS_HREF}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cc-accent)] hover:underline"
        >
          Review submissions & award points in Classroom Points
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        {loadError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-700 dark:text-red-300">
            {loadError}
          </p>
        ) : null}
      </div>

      <div className="instructor-kpi-grid instructor-kpi-grid--five">
        {[
          { label: "Students", value: payload?.summary.totalStudents ?? 0, icon: Users },
          { label: "Active in CodeBench", value: payload?.summary.activeStudents ?? 0, icon: Activity },
          { label: "Not started", value: payload?.summary.notStartedStudents ?? 0, icon: Users },
          { label: "Total runs", value: payload?.summary.totalRuns ?? 0, icon: Code2 },
          { label: "Submissions", value: payload?.summary.totalSubmissions ?? 0, icon: Sparkles },
        ].map((stat) => (
          <div key={stat.label} className={cn(PORTAL_CARD, "p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <stat.icon className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
              <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{stat.label}</p>
            </div>
            <p className={cn("text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {needsHelp.length > 0 ? (
        <section className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5")}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Students who may need help</h3>
          </div>
          <ul className="space-y-2">
            {needsHelp.slice(0, 8).map((row) => (
              <li
                key={row.studentDbId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{row.fullName}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {row.studentId} · {row.runs} runs
                    {row.lastCoraTool ? ` · last Cora: ${studioToolLabel(row.lastCoraTool)}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {row.compileErrors} faults / {row.compileSuccesses} clean
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={cn(PORTAL_CARD, "min-w-0 p-4 sm:p-5")}>
        <h3 className={cn("mb-3 text-sm font-semibold", PORTAL_TEXT)}>Recent activity</h3>
        {loading && !payload ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--cc-accent)]" />
          </div>
        ) : (payload?.recent.length ?? 0) === 0 ? (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            No CodeBench events yet. Activity appears after students press Run, use Cora, or submit assignments.
          </p>
        ) : (
          <ul className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {payload?.recent.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    toneClass(item.tone),
                  )}
                >
                  {item.title}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                    {item.studentName}
                    <span className={cn("ml-2 text-xs font-normal", PORTAL_TEXT_MUTED)}>{item.studentCode}</span>
                  </p>
                  {item.detail ? (
                    <p className={cn("mt-0.5 line-clamp-2 text-xs", PORTAL_TEXT_MUTED)}>{item.detail}</p>
                  ) : null}
                </div>
                <time className={cn("shrink-0 text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
                  {formatWhen(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FacultyIntegratedToolbar
        moduleId="codebench"
        embedded
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search students…"
        filters={
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="h-9 w-full min-w-[8.5rem] max-w-[10rem] rounded-lg sm:w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              <SelectItem value="active">Active in CodeBench</SelectItem>
              <SelectItem value="not_started">Not started</SelectItem>
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {rows.length} shown · last {payload?.windowDays ?? windowDays} days · scoped to your selected section
          </p>
        }
      />

      <div className={cn(PORTAL_CARD, "min-w-0 @container/student-activity-table")}>
        {loading && !payload ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className={cn("h-7 w-7 animate-spin", chrome.p.iconText)} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className={cn("font-medium", PORTAL_TEXT)}>No matching students</p>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Activity appears once students use CodeBench in this course.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)] @[32rem]/student-activity-table:hidden">
              {paginatedRows.map((row) => (
                <StudentActivityCard key={row.studentDbId} row={row} />
              ))}
            </div>

            <div className="hidden min-w-0 overflow-x-auto @[32rem]/student-activity-table:block">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-muted/20 text-left">
                    <th className="min-w-[9rem] px-3 py-3 font-medium sm:px-4">Student</th>
                    <th className="min-w-[5rem] px-2 py-3 font-medium sm:px-3">Section</th>
                    <th className="min-w-[8.5rem] px-2 py-3 font-medium sm:px-3">CodeBench usage</th>
                    <th className="min-w-[3.5rem] whitespace-nowrap px-2 py-3 font-medium sm:px-3">Runs</th>
                    <th className="min-w-[4.5rem] whitespace-nowrap px-2 py-3 font-medium sm:px-3">
                      Submissions
                    </th>
                    <th className="min-w-[5.5rem] whitespace-nowrap px-2 py-3 font-medium sm:px-3">
                      Last active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedRows.map((row) => (
                    <StudentActivityRow key={row.studentDbId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 pb-3">
              <FacultySidebarPagination
                page={studentsPage}
                totalPages={totalStudentsPages}
                totalItems={rows.length}
                pageSize={STUDENTS_PER_PAGE}
                onPageChange={setStudentsPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StudentActivityUsage({ row }: { row: CodebenchStudentActivityRow }) {
  return (
    <>
      <Badge
        variant="secondary"
        className={cn(
          "max-w-full whitespace-normal rounded-md text-xs",
          row.engaged ? "bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))]" : "bg-muted text-muted-foreground",
        )}
      >
        {row.activityLabel}
      </Badge>
      {row.detail ? <p className={cn("mt-1 text-xs break-words", PORTAL_TEXT_MUTED)}>{row.detail}</p> : null}
    </>
  )
}

function StudentActivityCard({ row }: { row: CodebenchStudentActivityRow }) {
  return (
    <article className="space-y-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className={cn("truncate font-medium", PORTAL_TEXT)} title={row.fullName}>
          {row.fullName}
        </p>
        <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)} title={row.studentId}>
          {row.studentId}
          {row.sessionCode || row.section ? ` · ${row.sessionCode || row.section}` : ""}
        </p>
      </div>
      <div className="min-w-0">
        <StudentActivityUsage row={row} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className={PORTAL_TEXT_MUTED}>Runs</dt>
          <dd className={cn("mt-0.5 font-medium tabular-nums", PORTAL_TEXT)}>{row.runs || "—"}</dd>
        </div>
        <div>
          <dt className={PORTAL_TEXT_MUTED}>Submissions</dt>
          <dd className={cn("mt-0.5 font-medium tabular-nums", PORTAL_TEXT)}>{row.submissions || "—"}</dd>
        </div>
        <div>
          <dt className={PORTAL_TEXT_MUTED}>Last active</dt>
          <dd className={cn("mt-0.5 font-medium tabular-nums", PORTAL_TEXT)}>{formatWhen(row.lastActivityAt)}</dd>
        </div>
      </dl>
    </article>
  )
}

function StudentActivityRow({ row }: { row: CodebenchStudentActivityRow }) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="min-w-0 max-w-[14rem] px-3 py-3 align-top sm:px-4">
        <div className="truncate font-medium text-[var(--foreground)]" title={row.fullName}>
          {row.fullName}
        </div>
        <div className={cn("truncate text-xs", PORTAL_TEXT_MUTED)} title={row.studentId}>
          {row.studentId}
        </div>
      </td>
      <td className={cn("min-w-0 max-w-[7rem] truncate px-2 py-3 align-top sm:px-3", PORTAL_TEXT_MUTED)}>
        {row.sessionCode || row.section || "—"}
      </td>
      <td className="min-w-0 px-2 py-3 align-top sm:px-3">
        <StudentActivityUsage row={row} />
      </td>
      <td className={cn("whitespace-nowrap px-2 py-3 align-top tabular-nums sm:px-3", PORTAL_TEXT)}>
        {row.runs || "—"}
      </td>
      <td className={cn("whitespace-nowrap px-2 py-3 align-top tabular-nums sm:px-3", PORTAL_TEXT)}>
        {row.submissions || "—"}
      </td>
      <td className={cn("whitespace-nowrap px-2 py-3 align-top tabular-nums sm:px-3", PORTAL_TEXT_MUTED)}>
        {formatWhen(row.lastActivityAt)}
      </td>
    </tr>
  )
}
