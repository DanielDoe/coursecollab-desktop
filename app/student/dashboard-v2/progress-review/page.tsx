"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"

const progressReviewTheme = getStudentModuleTheme("progress-review")
import { Progress } from "@/components/ui/progress"
import type { ProgressReviewSections } from "@/lib/midterm-progress-review/types"
import {
  periodBadgeLabel,
  type ProgressReviewPeriod,
} from "@/lib/midterm-progress-review/review-period"
import type { ProgressReviewGradebook } from "@/lib/midterm-progress-review/adjust-gradebook-for-review"

type ReviewPayload = {
  id: number
  reviewPeriod: string
  asOfDate: string | null
  sections: ProgressReviewSections | null
  contentMarkdown: string | null
  progressData: {
    gradebook?: ProgressReviewGradebook | null
    student?: { fullName: string }
    courseCode?: string | null
  } | null
  createdAt: string
}

function SectionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="border-[var(--border)] bg-[var(--card)] backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--cc-text)]">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", progressReviewTheme.page.iconBg, progressReviewTheme.page.iconText)}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-[var(--cc-text)] leading-relaxed space-y-3">
        {children}
      </CardContent>
    </Card>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[var(--cc-accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ProgressReviewPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [review, setReview] = useState<ReviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const studentSession = localStorage.getItem("studentSession")
    if (!studentSession) {
      router.push("/student/login")
      return
    }
    try {
      const session = JSON.parse(studentSession)
      const databaseId = sessionStorage.getItem("studentDatabaseId")
      const id = databaseId || session.databaseId?.toString() || session.id?.toString() || ""
      setStudentId(id)
    } catch {
      router.push("/student/login")
    } finally {
      setMounted(true)
    }
  }, [router])

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await studentApiFetch(`/api/student/progress-review?studentId=${encodeURIComponent(studentId)}`, {
          headers: { "x-student-id": studentId },
        })
        const data = await res.json()
        if (!cancelled && data.success) {
          setReview(data.review ?? null)
        }
      } catch {
        if (!cancelled) setReview(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
      </div>
    )
  }

  if (!review?.sections) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto text-center py-16">
        <ClipboardList className="size-12 mx-auto text-[var(--cc-text-muted)] mb-4" />
        <h2 className="text-xl font-semibold text-[var(--cc-text)] mb-2">No progress review yet</h2>
        <p className="text-[var(--cc-text-muted)]">
          Your instructor will publish a personalized progress review here when it is ready.
        </p>
      </motion.div>
    )
  }

  const s = review.sections
  const gb = review.progressData?.gradebook
  const courseCode = review.progressData?.courseCode
  const periodLabel =
    review.reviewPeriod === "targeted_practice"
      ? "Targeted Practice"
      : periodBadgeLabel(
          (review.reviewPeriod || "midterm") as ProgressReviewPeriod,
          review.asOfDate,
        )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 sm:space-y-6 w-full min-w-0 pb-10"
    >
      <div className="rounded-xl bg-[var(--muted)]/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Badge className={`${progressReviewTheme.page.badge} hover:opacity-90 border-0`}>{periodLabel}</Badge>
          {gb && (
            <div className="text-right">
              <div className={cn("text-3xl font-bold", progressReviewTheme.page.iconText)}>
                {gb.totalScore.toFixed(1)}%
              </div>
              {gb.gradeIsProvisional ? (
                <Badge variant="outline" className="mt-1">In progress</Badge>
              ) : gb.letterGrade ? (
                <Badge variant="outline" className="mt-1">{gb.letterGrade}</Badge>
              ) : null}
            </div>
          )}
        </div>
        {gb?.gradeIsProvisional && gb.pendingCategories.length > 0 && (
          <p className="mt-3 text-xs text-[var(--cc-text-muted)] max-w-3xl">
            Overall reflects graded work only — not your final course grade. Still pending:{" "}
            {gb.pendingCategories.join(", ")}.
          </p>
        )}
        <p className="mt-4 text-[var(--cc-text)] leading-relaxed max-w-3xl">{s.overallSummary}</p>
      </div>

      {gb && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Quiz", value: gb.quizScore, status: gb.categoryStatus?.quiz },
            { label: "Homework", value: gb.homeworkScore, status: gb.categoryStatus?.homework },
            { label: "Midterm", value: gb.midtermScore, status: gb.categoryStatus?.midterm },
            { label: "Attendance", value: gb.attendanceScore, status: gb.categoryStatus?.attendance },
            { label: "Classroom", value: gb.classroomScore, status: gb.categoryStatus?.classroom },
            {
              label: "Overall",
              value: gb.totalScore,
              status: "scored" as const,
              display: `${gb.totalScore.toFixed(1)}%`,
            },
          ].map((item) => {
            const isPending = item.status === "pending"
            const display =
              "display" in item && item.display
                ? item.display
                : isPending
                  ? "Pending"
                  : `${item.value.toFixed(1)}%`
            return (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-3"
              >
                <div className="text-xs text-[var(--cc-text-muted)] uppercase tracking-wide">{item.label}</div>
                <div
                  className={`text-lg font-bold mt-1 ${
                    isPending
                      ? "text-[var(--cc-text-muted)]"
                      : "text-[var(--cc-text)]"
                  }`}
                >
                  {display}
                </div>
                {!isPending && (
                  <Progress value={Math.min(100, item.value)} className="h-1 mt-2" />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionBlock title="What You're Doing Well" icon={Sparkles}>
          <BulletList items={s.strengths} />
        </SectionBlock>
        <SectionBlock title="Where to Focus Next" icon={Target}>
          <BulletList items={s.areasToImprove} />
        </SectionBlock>
      </div>

      <SectionBlock title="Assessments & Feedback" icon={BookOpen}>
        <p>{s.assessmentFeedback}</p>
      </SectionBlock>

      <SectionBlock title="Practice Hub & Lecture Practice" icon={TrendingUp}>
        <p>{s.practiceFeedback}</p>
      </SectionBlock>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionBlock title="Attendance" icon={Calendar}>
          <p>{s.attendanceFeedback}</p>
        </SectionBlock>
        <SectionBlock title="Classroom Participation" icon={Award}>
          <p>{s.classroomFeedback}</p>
        </SectionBlock>
      </div>

      <SectionBlock title="Your Action Plan" icon={ClipboardList}>
        <BulletList items={s.actionPlan} />
      </SectionBlock>

      <div className={cn("rounded-2xl border p-6", progressReviewTheme.page.border, progressReviewTheme.page.softBg)}>
        <p className={cn("text-sm font-semibold uppercase tracking-wide mb-2", progressReviewTheme.page.iconText)}>
          Encouragement
        </p>
        <p className="text-[var(--cc-text)] leading-relaxed">{s.encouragement}</p>
      </div>

      <p className="text-xs text-center text-[var(--cc-text-muted)]">
        Review published {new Date(review.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
      </p>
    </motion.div>
  )
}
