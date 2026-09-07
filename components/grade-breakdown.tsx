"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Target, Award, Users, BookOpen, ClipboardList, Sparkles, TrendingUp, ChevronRight } from "lucide-react"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import {
  buildStudentGradeCategories,
  formatStudentCategoryScore,
  isCategoryPending,
  resolveStudentGradeDisplay,
  studentGradeCategoryColor,
} from "@/lib/student-grade-display"
import type { GradeCategoryDetailsPayload, GradeCategoryKey } from "@/lib/student-grade-category-details"
import { cn } from "@/lib/utils"
import { EMBED_LIST, EMBED_LIST_TILE } from "@/components/student/dashboard-v2/embed-module-ui"

interface GradeBreakdownProps {
  studentId: number
  session: string
  reloadToken?: number
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Quizzes: <BookOpen className="h-6 w-6" />,
  Homework: <FileText className="h-6 w-6" />,
  Midterm: <ClipboardList className="h-6 w-6" />,
  Final: <Award className="h-6 w-6" />,
  Attendance: <Users className="h-6 w-6" />,
  Projects: <Target className="h-6 w-6" />,
  Classroom: <TrendingUp className="h-6 w-6" />,
  Engagement: <Sparkles className="h-6 w-6" />,
}

const CATEGORY_NAME_TO_KEY: Record<string, GradeCategoryKey> = {
  Quizzes: "quiz",
  Homework: "homework",
  Midterm: "midterm",
  Final: "final",
  Attendance: "attendance",
  Projects: "project",
  Classroom: "classroom",
  Engagement: "engagement",
}

export function GradeBreakdown({ studentId, session, reloadToken = 0 }: GradeBreakdownProps) {
  const [loading, setLoading] = useState(true)
  const [grade, setGrade] = useState<Record<string, unknown> | null>(null)
  const [weights, setWeights] = useState<Record<string, unknown> | null>(null)
  const [gradeDisplay, setGradeDisplay] = useState<ReturnType<typeof resolveStudentGradeDisplay> | null>(null)
  const [provisional, setProvisional] = useState<Record<string, unknown> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<GradeCategoryKey | null>(null)
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState("")
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [categoryDetails, setCategoryDetails] = useState<GradeCategoryDetailsPayload | null>(null)

  useEffect(() => {
    setLoading(true)
    studentApiFetch(`/api/grades/student?studentId=${studentId}&session=${encodeURIComponent(session)}&recalculate=true`, {
      headers: getStudentAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.grade || data.weights) {
          setGrade(data.grade)
          setWeights(data.weights)
          setProvisional(data.provisional ?? null)
          setGradeDisplay(resolveStudentGradeDisplay(data))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, session, reloadToken])

  const openCategoryDetails = async (categoryName: string) => {
    const key = CATEGORY_NAME_TO_KEY[categoryName]
    if (!key) return

    setSelectedCategory(key)
    setSelectedCategoryLabel(categoryName)
    setCategoryDetails(null)
    setDetailsLoading(true)

    try {
      const res = await fetch(
        `/api/grades/student/category-details?studentId=${studentId}&session=${encodeURIComponent(session)}&category=${key}`,
        { headers: getStudentAuthHeaders() },
      )
      const data = await res.json()
      if (res.ok && data.details) {
        setCategoryDetails(data.details as GradeCategoryDetailsPayload)
      }
    } catch {
      setCategoryDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeCategoryDetails = () => {
    setSelectedCategory(null)
    setSelectedCategoryLabel("")
    setCategoryDetails(null)
    setDetailsLoading(false)
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
        <p className="mt-3 text-sm text-[var(--cc-text-muted)]">Loading breakdown…</p>
      </div>
    )
  }

  const categories = buildStudentGradeCategories({
    grade,
    weights,
    provisional: provisional as Parameters<typeof buildStudentGradeCategories>[0]["provisional"],
  })

  const totalScore = gradeDisplay?.totalScore ?? 0
  const letterGrade = gradeDisplay?.letterLabel ?? "—"
  const categoryStatus = gradeDisplay?.categoryStatus
  const includedWeight = Number((provisional as { includedWeight?: number } | null)?.includedWeight ?? 0)

  let nextThreshold = 0
  let nextGrade = ""
  if (totalScore < 60) {
    nextThreshold = 60
    nextGrade = "D-"
  } else if (totalScore < 70) {
    nextThreshold = 70
    nextGrade = "C-"
  } else if (totalScore < 80) {
    nextThreshold = 80
    nextGrade = "B-"
  } else if (totalScore < 90) {
    nextThreshold = 90
    nextGrade = "A-"
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
              {gradeDisplay?.gradeIsProvisional ? "Grade so far" : "Current grade"}
            </p>
            <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
              {gradeDisplay?.gradeIsProvisional
                ? `Based on ${includedWeight > 0 ? `${includedWeight.toFixed(0)}%` : "completed"} of course weight${
                    gradeDisplay.pendingCategories.length > 0
                      ? ` · pending ${gradeDisplay.pendingCategories.join(", ")}`
                      : ""
                  }`
                : "Tap a category for item-level details"}
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-[var(--cc-text)]">
            {totalScore.toFixed(1)}%
            <span className="ml-2 text-base text-[var(--cc-accent)]">{letterGrade}</span>
          </p>
        </div>

        <div>
          <div className={cn(EMBED_LIST)}>
            {categories.map((cat) => {
              const pending = isCategoryPending(categoryStatus, cat.name)
              const scoreLabel = formatStudentCategoryScore(cat.score, cat.name, categoryStatus, cat.underReview)
              const color = studentGradeCategoryColor(cat.name)
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => openCategoryDetails(cat.name)}
                  className={cn(
                    EMBED_LIST_TILE,
                    "space-y-3 w-full text-left cursor-pointer hover:bg-[var(--muted)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex size-14 shrink-0 items-center justify-center rounded-[14px]"
                        style={{ backgroundColor: color, color: "#FFFFFF" }}
                      >
                        {CATEGORY_ICONS[cat.name]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--cc-text)]">{cat.name}</p>
                        <p className="text-xs text-[var(--cc-text-muted)]">{cat.weight.toFixed(0)}% of course</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <p
                        className={cn("text-sm font-semibold tabular-nums", pending && "text-[var(--cc-text-muted)]")}
                        style={pending ? undefined : { color }}
                      >
                        {scoreLabel}
                      </p>
                      <ChevronRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
                    </div>
                  </div>

                  {!pending ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]/60">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, cat.name === "Engagement" ? cat.score : cat.score)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--cc-text-muted)]">Contribution to grade so far</span>
                        <span className="font-semibold tabular-nums" style={{ color }}>
                          +{cat.contribution.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--cc-text-muted)]">Not graded yet — tap to see status.</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {nextThreshold > 0 && !gradeDisplay?.gradeIsProvisional ? (
          <div className="rounded-xl bg-[var(--cc-accent-soft)]/40 px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-[var(--cc-text)]">Next milestone</p>
            <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
              {Math.max(0, nextThreshold - totalScore).toFixed(1)} more points to reach {nextThreshold}% ({nextGrade})
            </p>
          </div>
        ) : null}
      </div>

      <Dialog open={selectedCategory != null} onOpenChange={(open) => !open && closeCategoryDetails()}>
        <DialogContent className="max-h-[min(85vh,720px)] overflow-hidden rounded-xl border-[var(--border)] !bg-[var(--cc-modal-surface,#fff)] p-0 shadow-2xl sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--border)] bg-[var(--cc-modal-surface,#fff)] px-4 py-4 sm:px-5">
            <DialogTitle className="text-base text-[var(--cc-text)]">
              {categoryDetails?.categoryLabel ?? selectedCategoryLabel}
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--cc-text-muted)]">
              {detailsLoading
                ? "Loading details…"
                : categoryDetails?.summary ?? "Individual items that make up this grade category."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(60vh,520px)] overflow-y-auto bg-[var(--cc-modal-surface,#fff)] px-4 py-3 sm:px-5">
            {detailsLoading ? (
              <div className="py-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
              </div>
            ) : categoryDetails && categoryDetails.items.length > 0 ? (
              <div className={EMBED_LIST}>
                {categoryDetails.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--cc-modal-muted,var(--muted))] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--cc-text)]">{item.title}</p>
                      {item.subtitle ? (
                        <p className="text-xs text-[var(--cc-text-muted)]">{item.subtitle}</p>
                      ) : null}
                      {item.status ? (
                        <p className="mt-0.5 text-xs capitalize text-[var(--cc-text-muted)]">{item.status}</p>
                      ) : null}
                    </div>
                    {item.scoreLabel ? (
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-accent-dark)]">
                        {item.scoreLabel}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--cc-text-muted)]">
                {isCategoryPending(categoryStatus, selectedCategoryLabel)
                  ? "Nothing graded in this category yet."
                  : "No individual items to show for this category yet."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
