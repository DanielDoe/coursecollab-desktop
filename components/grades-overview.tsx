"use client"

import { useEffect, useState } from "react"
import { getStudentAuthHeaders } from "@/lib/auth"
import {
  buildStudentGradeCategories,
  formatStudentCategoryScore,
  resolveStudentGradeDisplay,
  studentGradeCategoryColor,
  type StudentGradeCategoryRow,
} from "@/lib/student-grade-display"
import { cn } from "@/lib/utils"
import { EMBED_LIST, EMBED_LIST_TILE } from "@/components/student/dashboard-v2/embed-module-ui"

interface GradesOverviewProps {
  studentId: number
  session: string
}

export function GradesOverview({ studentId, session }: GradesOverviewProps) {
  const [loading, setLoading] = useState(true)
  const [grade, setGrade] = useState<Record<string, unknown> | null>(null)
  const [weights, setWeights] = useState<Record<string, unknown> | null>(null)
  const [gradeDisplay, setGradeDisplay] = useState<ReturnType<typeof resolveStudentGradeDisplay> | null>(null)
  const [provisional, setProvisional] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetchGrades()
  }, [studentId, session])

  const fetchGrades = async () => {
    try {
      const response = await fetch(
        `/api/grades/student?studentId=${studentId}&session=${session}&recalculate=true`,
        { headers: getStudentAuthHeaders() },
      )
      const data = await response.json()

      if (response.ok) {
        setGrade(data.grade)
        setWeights(data.weights)
        setProvisional(data.provisional ?? null)
        setGradeDisplay(resolveStudentGradeDisplay(data))
      }
    } catch (error) {
      console.error("Error fetching grades:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
        <p className="mt-3 text-sm text-[var(--cc-text-muted)]">Loading grades…</p>
      </div>
    )
  }

  const categories: StudentGradeCategoryRow[] = buildStudentGradeCategories({
    grade,
    weights,
    provisional: provisional as Parameters<typeof buildStudentGradeCategories>[0]["provisional"],
  })

  const totalScore = gradeDisplay?.totalScore ?? 0
  const letterLabel = gradeDisplay?.letterLabel ?? "—"
  const isProvisional = gradeDisplay?.gradeIsProvisional ?? false
  const includedWeight = Number((provisional as { includedWeight?: number } | null)?.includedWeight ?? 0)
  const scoredCategories = categories.filter((c) => !c.pending)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            {isProvisional ? "Grade so far" : "Overall grade"}
          </p>
          <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
            {isProvisional
              ? `Based on ${includedWeight > 0 ? `${includedWeight.toFixed(0)}%` : "completed"} of course weight`
              : "Weighted total across graded categories"}
            {isProvisional && gradeDisplay?.pendingCategories.length
              ? ` · pending ${gradeDisplay.pendingCategories.join(", ")}`
              : ""}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--cc-text)]">
          {totalScore.toFixed(1)}%
          <span className="ml-2 text-base text-[var(--cc-accent)]">{letterLabel}</span>
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--cc-text)]">Category breakdown</h3>
        <div className={EMBED_LIST}>
          {categories.map((cat) => (
            <CategoryRow key={cat.name} cat={cat} categoryStatus={gradeDisplay?.categoryStatus} />
          ))}
        </div>
      </div>

      {scoredCategories.length > 0 ? (
        <p className="text-xs text-[var(--cc-text-muted)]">
          Attendance uses classes held so far only — future sessions are not counted against you.
        </p>
      ) : null}
    </div>
  )
}

function CategoryRow({
  cat,
  categoryStatus,
}: {
  cat: StudentGradeCategoryRow
  categoryStatus: ReturnType<typeof resolveStudentGradeDisplay>["categoryStatus"]
}) {
  const scoreLabel = formatStudentCategoryScore(cat.score, cat.name, categoryStatus, cat.underReview)
  const color = studentGradeCategoryColor(cat.name)

  return (
    <div className={cn(EMBED_LIST_TILE, "flex min-h-[88px] items-center gap-3")}>
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-[14px] text-lg font-semibold"
        style={{ backgroundColor: color, color: "#FFFFFF" }}
      >
        {cat.name.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--cc-text)]">{cat.name}</p>
        <p className="text-xs text-[var(--cc-text-muted)]">
          {cat.pending
            ? cat.underReview
              ? "Under instructor review"
              : "Not graded yet"
            : `${cat.weight.toFixed(0)}% of course weight`}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn("text-sm font-semibold tabular-nums", cat.pending && "text-[var(--cc-text-muted)]")}
          style={cat.pending ? undefined : { color }}
        >
          {scoreLabel}
        </p>
        {!cat.pending ? (
          <p className="text-xs tabular-nums" style={{ color }}>
            +{cat.contribution.toFixed(1)}% toward grade so far
          </p>
        ) : null}
      </div>
    </div>
  )
}
