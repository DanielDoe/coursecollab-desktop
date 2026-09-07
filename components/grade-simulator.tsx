"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calculator } from "lucide-react"
import {
  calculateProvisionalTotalScore,
  calculateLetterGrade,
  type GradeWeights,
  type ProvisionalCategoryKey,
} from "@/lib/grades-calculator"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { EMBED_LIST, EMBED_LIST_TILE } from "@/components/student/dashboard-v2/embed-module-ui"

interface GradeSimulatorProps {
  studentId: number
  session: string
}

const FIELDS = [
  { key: "quiz", label: "Quizzes", id: "quiz" },
  { key: "homework", label: "Homework", id: "homework" },
  { key: "midterm", label: "Midterm", id: "midterm" },
  { key: "final", label: "Final Exam", id: "final" },
  { key: "attendance", label: "Attendance", id: "attendance" },
  { key: "project", label: "Projects", id: "project" },
  { key: "classroom", label: "Classroom", id: "classroom" },
  { key: "engagement", label: "Engagement", id: "engagement" },
] as const


export function GradeSimulator({ studentId, session }: GradeSimulatorProps) {
  const [weights, setWeights] = useState<GradeWeights | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [pendingKeys, setPendingKeys] = useState<Set<ProvisionalCategoryKey>>(new Set())
  const [projectedGrade, setProjectedGrade] = useState<{
    total: number
    letter: string
    contributions: Partial<Record<ProvisionalCategoryKey, number>>
    pendingCategories: string[]
  } | null>(null)

  useEffect(() => {
    studentApiFetch(`/api/grades/student?studentId=${studentId}&session=${session}&recalculate=true`, {
      headers: getStudentAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.grade) {
          const prov = data.provisional as {
            scores?: Record<string, number>
            categoryStatus?: Record<string, string>
          } | null
          const pending = new Set<ProvisionalCategoryKey>()
          if (prov?.categoryStatus) {
            for (const [key, status] of Object.entries(prov.categoryStatus)) {
              if (status === "pending") pending.add(key as ProvisionalCategoryKey)
            }
          }
          setPendingKeys(pending)
          setScores({
            quiz: Number(prov?.scores?.quiz ?? data.grade.quiz_score) || 0,
            homework: Number(prov?.scores?.homework ?? data.grade.homework_score) || 0,
            midterm: Number(prov?.scores?.midterm ?? data.grade.midterm_score) || 0,
            final: Number(prov?.scores?.final ?? data.grade.final_score) || 0,
            attendance: Number(prov?.scores?.attendance ?? data.grade.attendance_score) || 0,
            project: Number(prov?.scores?.project ?? data.grade.project_score) || 0,
            classroom: Number(prov?.scores?.classroom ?? data.grade.classroom_score) || 0,
            engagement: Number(prov?.scores?.engagement ?? data.grade.engagement_credits) || 0,
          })
        }
        if (data.weights) {
          setWeights({
            quiz_weight: Number(data.weights.quiz_weight) || 10,
            homework_weight: Number(data.weights.homework_weight) || 10,
            midterm_weight: Number(data.weights.midterm_weight) || 20,
            final_weight: Number(data.weights.final_weight) || 25,
            attendance_weight: Number(data.weights.attendance_weight) || 10,
            project_weight: Number(data.weights.project_weight) || 15,
            classroom_weight: Number(data.weights.classroom_weight) || 5,
            engagement_weight: Number(data.weights.engagement_weight) || 5,
          })
        }
      })
      .catch(() => {})
  }, [studentId, session])

  const calculateProjected = () => {
    if (!weights) return
    const numericScores = Object.fromEntries(
      FIELDS.map((f) => [f.key, Math.max(0, Math.min(100, Number(scores[f.key]) || 0))]),
    )
    const { total, contributions, pendingCategories } = calculateProvisionalTotalScore(
      numericScores as Record<ProvisionalCategoryKey, number>,
      weights,
      pendingKeys,
    )
    setProjectedGrade({ total, letter: calculateLetterGrade(total), contributions, pendingCategories })
  }

  if (!weights) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
        <p className="mt-3 text-sm text-[var(--cc-text-muted)]">Loading simulator…</p>
      </div>
    )
  }

  const contributionRows = projectedGrade
    ? FIELDS.filter((f) => !pendingKeys.has(f.key as ProvisionalCategoryKey) && (projectedGrade.contributions[f.key as ProvisionalCategoryKey] ?? 0) > 0)
    : []

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">What-if scenarios</h3>
        <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
          Adjust hypothetical scores to see your projected grade so far. Pending categories are excluded.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((f) => {
          const isPending = pendingKeys.has(f.key as ProvisionalCategoryKey)
          return (
            <div key={f.key} className="space-y-1.5 min-w-0">
              <Label htmlFor={f.id} className="text-xs font-medium text-[var(--cc-text-muted)]">
                {f.label}
                {isPending ? " (pending)" : ""}
              </Label>
              <Input
                id={f.id}
                type="number"
                min={0}
                max={100}
                disabled={isPending}
                value={isPending ? "" : (scores[f.key] ?? "")}
                placeholder={isPending ? "—" : "0"}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0
                  setScores((prev) => ({ ...prev, [f.key]: Math.max(0, Math.min(100, v)) }))
                }}
                className="h-10 rounded-xl border-[var(--border)] bg-[var(--muted)]/25 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30 disabled:opacity-50"
              />
            </div>
          )
        })}
      </div>

      <Button
        onClick={calculateProjected}
        className="h-10 w-full rounded-xl bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-dark)]"
      >
        <Calculator className="mr-2 h-4 w-4" />
        Calculate projected grade
      </Button>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            Projected result
          </p>
          {projectedGrade ? (
            <p className="text-2xl font-semibold tabular-nums text-[var(--cc-text)]">
              {projectedGrade.total.toFixed(1)}%
              <span className="ml-2 text-base text-[var(--cc-accent)]">{projectedGrade.letter}</span>
            </p>
          ) : null}
        </div>
        {projectedGrade ? (
          <>
            {projectedGrade.pendingCategories.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
                Excludes: {projectedGrade.pendingCategories.join(", ")}
              </p>
            ) : null}
            {contributionRows.length > 0 ? (
              <div className={cn(EMBED_LIST, "mt-4")}>
                {contributionRows.map((f) => (
                  <div
                    key={f.key}
                    className={cn(EMBED_LIST_TILE, "flex items-center justify-between gap-2 py-2.5")}
                  >
                    <span className="text-sm text-[var(--cc-text)]">{f.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--cc-accent-dark)]">
                      +{(projectedGrade.contributions[f.key as ProvisionalCategoryKey] ?? 0).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--cc-text-muted)]">
            Enter scores above and calculate to see your projected grade.
          </p>
        )}
      </div>
    </div>
  )
}
