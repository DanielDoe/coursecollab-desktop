"use client"

import { useState } from "react"
import { AlertTriangle, Code2, Loader2, RefreshCw, Sparkles, Users } from "lucide-react"
import {
  CODEBENCH_INSIGHTS_PAGE_SIZE,
  CodebenchListPagination,
  paginateCodebenchList,
} from "@/components/instructor/codebench/CodebenchListPagination"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { Button } from "@/components/ui/button"
import { useInstructorCodebenchStudioAnalytics } from "@/hooks/use-instructor-codebench-studio-analytics"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function FacultyCodebenchStudioAnalytics() {
  const chrome = facultyEmbedChrome("codebench")
  const { data, loading, error, reload } = useInstructorCodebenchStudioAnalytics()
  const [faultPage, setFaultPage] = useState(1)
  const [studentPage, setStudentPage] = useState(1)
  const faultPaging = paginateCodebenchList(data.families, faultPage, CODEBENCH_INSIGHTS_PAGE_SIZE)
  const studentPaging = paginateCodebenchList(data.students, studentPage, CODEBENCH_INSIGHTS_PAGE_SIZE)

  if (loading) {
    return (
      <div className="flex min-h-[240px] flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--cc-accent)]" />
      </div>
    )
  }

  const hasActivity = data.runs > 0 || data.activeStudents > 0 || data.families.length > 0

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
      {error ? (
        <div className={cn(chrome.card, "flex flex-wrap items-center justify-between gap-3 p-4")}>
          <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      <section className={cn(chrome.card, "space-y-4 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[var(--cc-accent)]" />
              <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>CodeBench studio pulse</h2>
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{data.teachingMove}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="instructor-kpi-grid instructor-kpi-grid--four gap-2.5">
          <DashboardKpiCard
            label="Active builders"
            value={data.activeStudents}
            sub={data.activeStudents === 1 ? "Student ran code" : "Students ran code"}
            icon={Users}
            iconBg="bg-violet-500/10 dark:bg-violet-500/15"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <DashboardKpiCard
            label="Runs"
            value={data.runs}
            sub={data.compilesOk > 0 ? `${data.compilesOk} clean compiles` : "Press Run to start"}
            icon={Code2}
            iconBg="bg-sky-500/10 dark:bg-sky-500/15"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <DashboardKpiCard
            label="Clean compiles"
            value={`${data.successRate}%`}
            sub={`${data.compilesOk} of ${Math.max(data.runs, 1)} runs`}
            icon={Sparkles}
            iconBg="bg-emerald-500/10 dark:bg-emerald-500/15"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <DashboardKpiCard
            label="Compiler faults"
            value={data.compilesFail}
            sub={data.families[0]?.label ? `Top: ${data.families[0].label}` : "No faults yet"}
            icon={AlertTriangle}
            iconBg="bg-amber-500/10 dark:bg-amber-500/15"
            iconColor="text-amber-600 dark:text-amber-400"
          />
        </div>

        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          Last {data.windowDays} days
          {data.submissions > 0 ? ` · ${data.submissions} graded submissions` : ""}
          {data.avgScore != null ? ` · avg score ${data.avgScore}` : ""}
        </p>

        {!hasActivity ? (
          <p className={cn("rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs", PORTAL_TEXT_MUTED)}>
            No compile telemetry yet. Insights populate after students run code in CodeBench for this course.
          </p>
        ) : null}
      </section>

      <section className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Class fault heat map</h3>
        {data.families.length === 0 ? (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            No compile faults recorded yet. They appear after students press Run in CodeBench.
          </p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {faultPaging.rows.map((item) => (
                <li key={item.family} className="rounded-lg border border-[var(--border)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-semibold", PORTAL_TEXT)}>{item.label}</span>
                    <span className="text-xs font-semibold text-[var(--cc-accent)]">×{item.count}</span>
                  </div>
                  <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{item.tip}</p>
                </li>
              ))}
            </ul>
            <CodebenchListPagination
              page={faultPaging.page}
              pageSize={CODEBENCH_INSIGHTS_PAGE_SIZE}
              totalItems={faultPaging.total}
              onPageChange={setFaultPage}
            />
          </div>
        )}
      </section>

      {data.tools.length > 0 ? (
        <section className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Cora tools the class reaches for</h3>
          <ul className="flex flex-wrap gap-2">
            {data.tools.map((item) => (
              <li
                key={item.tool}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--cc-text)]"
              >
                {item.tool}
                <span className="ml-1 text-[var(--cc-text-muted)]">×{item.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.students.length > 0 ? (
        <section className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Students who need a compile huddle</h3>
          <ul className="space-y-1.5">
            {studentPaging.rows.map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{student.name}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {student.code ?? "Student"} · {student.runs} runs
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-[var(--cc-text-muted)]">
                  {student.errors} faults / {student.successes} clean
                </p>
              </li>
            ))}
          </ul>
          <CodebenchListPagination
            page={studentPaging.page}
            pageSize={CODEBENCH_INSIGHTS_PAGE_SIZE}
            totalItems={studentPaging.total}
            onPageChange={setStudentPage}
          />
        </section>
      ) : null}
    </div>
  )
}

