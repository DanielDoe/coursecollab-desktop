"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Users } from "lucide-react"
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
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import type {
  InstructorModuleActivityKind,
  ModuleStudentActivityPayload,
  ModuleStudentActivityRow,
} from "@/lib/instructor-module-student-activity"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { toast } from "@/lib/app-toast"

const STUDENTS_PER_PAGE = 20

const MODULE_COPY: Record<
  InstructorModuleActivityKind,
  { title: string; description: string; pointsLabel: string | null }
> = {
  syllabus: {
    title: "Syllabus student activity",
    description: "Who opened the published syllabus, when, and whether engagement credits were awarded.",
    pointsLabel: "Points awarded",
  },
  flashcards: {
    title: "Flashcard student activity",
    description: "Study sessions, decks touched, and engagement points earned from flashcard practice.",
    pointsLabel: "Points earned",
  },
  notes: {
    title: "Course notes student activity",
    description: "Which published notes students opened and their most recent read time.",
    pointsLabel: null,
  },
  lectures: {
    title: "Lecture student activity",
    description: "Lectures opened, completion progress, and last access time per student.",
    pointsLabel: null,
  },
}

function formatWhen(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type Props = {
  module: InstructorModuleActivityKind
  moduleId: string
  embedInDashboard?: boolean
}

export function InstructorModuleStudentActivityView({ module, moduleId, embedInDashboard = false }: Props) {
  const scopeKey = useInstructorScopeKey()
  const chrome = facultyEmbedChrome(moduleId)
  const copy = MODULE_COPY[module]
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<ModuleStudentActivityPayload | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "engaged" | "not_started">("all")
  const [studentsPage, setStudentsPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(
        `/api/instructor/module-student-activity?module=${encodeURIComponent(module)}`,
      )
      const data = (await res.json()) as ModuleStudentActivityPayload & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load student activity")
      setPayload(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load student activity")
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [module])

  useEffect(() => {
    void load()
  }, [load, scopeKey])

  const filterOptions = [
    { value: "all", label: "All students" },
    { value: "engaged", label: "Engaged" },
    { value: "not_started", label: "Not started" },
  ] as const

  const rows = useMemo(() => {
    const students = payload?.students ?? []
    const q = search.trim().toLowerCase()
    return students.filter((row) => {
      if (filter === "engaged" && !row.engaged) return false
      if (filter === "not_started" && row.engaged) return false
      if (!q) return true
      return [row.fullName, row.studentId, row.email, row.section, row.sessionCode]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(q))
    })
  }, [payload?.students, search, filter])

  const totalStudentsPages = Math.max(1, Math.ceil(rows.length / STUDENTS_PER_PAGE))

  const paginatedRows = useMemo(() => {
    const start = (studentsPage - 1) * STUDENTS_PER_PAGE
    return rows.slice(start, start + STUDENTS_PER_PAGE)
  }, [rows, studentsPage])

  useEffect(() => {
    setStudentsPage(1)
  }, [search, filter])

  useEffect(() => {
    if (studentsPage > totalStudentsPages) {
      setStudentsPage(totalStudentsPages)
    }
  }, [studentsPage, totalStudentsPages])

  const showPoints = copy.pointsLabel != null

  return (
    <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <div className={cn("space-y-1", embedInDashboard && "shrink-0")}>
        <h2 className={cn("text-lg font-semibold tracking-tight", PORTAL_TEXT)}>{copy.title}</h2>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{copy.description}</p>
      </div>

      {payload?.meta?.syllabusPublished === false ? (
        <div className={cn(PORTAL_CARD, "p-4 text-sm", PORTAL_TEXT_MUTED)}>
          Publish the syllabus first — student views appear here after it is live.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Students", value: payload?.summary.totalStudents ?? 0 },
          { label: "Engaged", value: payload?.summary.engagedStudents ?? 0 },
          { label: "Not started", value: payload?.summary.notStartedStudents ?? 0 },
          ...(showPoints
            ? [{ label: copy.pointsLabel ?? "Points", value: payload?.summary.totalPointsAwarded ?? 0 }]
            : []),
        ].map((stat) => (
          <div key={stat.label} className={cn(PORTAL_CARD, "p-4")}>
            <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{stat.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <FacultyIntegratedToolbar
        moduleId={moduleId}
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search students…"
        filters={
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="h-9 w-[150px] rounded-lg">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        trailing={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {rows.length} shown · scoped to your selected section
          </p>
        }
      />

      <div className={cn(PORTAL_CARD, "overflow-hidden", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
        {loading && !payload ? (
          <div className={cn("flex items-center justify-center", embedInDashboard ? "min-h-0 flex-1" : "min-h-[240px]")}>
            <Loader2 className={cn("h-7 w-7 animate-spin", chrome.p.iconText)} />
          </div>
        ) : rows.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center justify-center gap-2 p-8 text-center",
            embedInDashboard ? "min-h-0 flex-1 border-dashed" : "min-h-[240px]",
          )}>
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className={cn("font-medium", PORTAL_TEXT)}>No matching students</p>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Activity will appear once students interact with this module.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-muted/20 text-left">
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-4 py-3 font-medium">Activity</th>
                    <th className="px-4 py-3 font-medium">Last activity</th>
                    {showPoints ? <th className="px-4 py-3 font-medium">{copy.pointsLabel}</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedRows.map((row) => (
                    <ActivityRow key={row.studentDbId} row={row} showPoints={showPoints} moduleId={moduleId} />
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

function ActivityRow({
  row,
  showPoints,
  moduleId,
}: {
  row: ModuleStudentActivityRow
  showPoints: boolean
  moduleId: string
}) {
  const chrome = facultyEmbedChrome(moduleId)
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-[var(--foreground)]">{row.fullName}</div>
        <div className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.studentId}</div>
        {row.email ? <div className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.email}</div> : null}
      </td>
      <td className={cn("px-4 py-3 align-top", PORTAL_TEXT_MUTED)}>
        {row.sessionCode || row.section || "—"}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-md text-xs",
              row.engaged ? chrome.p.softBg : "bg-muted text-muted-foreground",
            )}
          >
            {row.activityLabel}
          </Badge>
        </div>
        {row.detail ? <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>{row.detail}</p> : null}
      </td>
      <td className={cn("px-4 py-3 align-top whitespace-nowrap", PORTAL_TEXT_MUTED)}>
        {formatWhen(row.lastActivityAt)}
      </td>
      {showPoints ? (
        <td className={cn("px-4 py-3 align-top tabular-nums", PORTAL_TEXT)}>
          {row.pointsAwarded > 0 ? row.pointsAwarded : "—"}
        </td>
      ) : null}
    </tr>
  )
}
