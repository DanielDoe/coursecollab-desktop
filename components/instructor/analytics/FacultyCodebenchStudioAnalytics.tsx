"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Code2, Loader2, Sparkles, Users } from "lucide-react"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { AN_PANEL, AN_PANEL_INNER, AN_TITLE, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/analytics/analytics-instructor-ui"
import { cn } from "@/lib/utils"

type Payload = {
  windowDays: number
  runs: number
  compilesOk: number
  compilesFail: number
  successRate: number
  activeStudents: number
  submissions: number
  avgScore: number | null
  families: Array<{ family: string; label: string; tip: string; count: number }>
  tools: Array<{ tool: string; count: number }>
  students: Array<{ id: number; name: string; code: string | null; errors: number; successes: number; runs: number }>
  teachingMove: string
}

export function FacultyCodebenchStudioAnalytics() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await instructorApiFetch("/api/instructor/codebench/studio-analytics")
        const payload = (await res.json()) as Payload
        if (!cancelled) setData(payload)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--cc-accent)]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className={cn(AN_PANEL, AN_PANEL_INNER)}>
        <p className={AN_TITLE}>CodeBench studio</p>
        <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>Could not load studio analytics for this course.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className={cn(AN_PANEL, AN_PANEL_INNER)}>
        <div className="mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[var(--cc-accent)]" />
          <h2 className={AN_TITLE}>CodeBench studio pulse</h2>
        </div>
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{data.teachingMove}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Active builders" value={data.activeStudents} icon={Users} />
          <Kpi label="Runs" value={data.runs} icon={Code2} />
          <Kpi label="Clean compiles" value={`${data.successRate}%`} icon={Sparkles} />
          <Kpi label="Compiler faults" value={data.compilesFail} icon={AlertTriangle} />
        </div>
        <p className={cn("mt-3 text-xs", PORTAL_TEXT_MUTED)}>
          Last {data.windowDays} days
          {data.submissions > 0 ? ` · ${data.submissions} graded submissions` : ""}
          {data.avgScore != null ? ` · avg score ${data.avgScore}` : ""}
        </p>
      </section>

      <section className={cn(AN_PANEL, AN_PANEL_INNER)}>
        <h3 className={cn("mb-3 text-sm font-semibold", PORTAL_TEXT)}>Class fault heat map</h3>
        {data.families.length === 0 ? (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            No compile faults recorded yet. They appear after students press Run in CodeBench.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.families.map((item) => (
              <li key={item.family} className="rounded-lg border border-[var(--border)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-semibold", PORTAL_TEXT)}>{item.label}</span>
                  <span className="text-xs font-semibold text-[var(--cc-accent)]">×{item.count}</span>
                </div>
                <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{item.tip}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.tools.length > 0 ? (
        <section className={cn(AN_PANEL, AN_PANEL_INNER)}>
          <h3 className={cn("mb-3 text-sm font-semibold", PORTAL_TEXT)}>Cora tools the class reaches for</h3>
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
        <section className={cn(AN_PANEL, AN_PANEL_INNER)}>
          <h3 className={cn("mb-3 text-sm font-semibold", PORTAL_TEXT)}>Students who need a compile huddle</h3>
          <ul className="space-y-1.5">
            {data.students.map((student) => (
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
        </section>
      ) : null}
    </div>
  )
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Code2 }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold text-[var(--cc-text)]">{value}</p>
    </div>
  )
}
