"use client"

import { useState, useEffect } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Lightbulb, ArrowRight, AlertCircle, TrendingUp } from "lucide-react"
import { CardWrapper } from "./CardWrapper"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { resolveStudentDatabaseId, resolveStudentDisplayId, resolveStudentSection } from "@/lib/auth"
import {
  fetchCachedAttendance,
  fetchCachedFinals,
  fetchCachedGrades,
  fetchCachedHomeworkHistory,
  fetchCachedQuizHistory,
} from "@/lib/dashboard-v2/student-stats-client"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"

interface Insight {
  id: string
  message: string
  type: "info" | "warning" | "tip"
  action?: { label: string; href: string }
}

const insightTheme = getStudentModuleTheme("dashboard").page

export function PerformanceInsightsCard() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const displayId = resolveStudentDisplayId()
    const section = resolveStudentSection()

    if (!dbId) {
      setLoading(false)
      return
    }

    const fetchAndGenerate = async () => {
      try {
        const homeworkStudentId = displayId || dbId
        const [gradePayload, quizPayload, homeworkPayload, attendancePayload, finalsPayload] = await Promise.all([
          fetchCachedGrades(dbId, section),
          fetchCachedQuizHistory(dbId),
          homeworkStudentId && section
            ? fetchCachedHomeworkHistory(homeworkStudentId, section)
            : Promise.resolve(null),
          fetchCachedAttendance(dbId),
          fetchCachedFinals(displayId || dbId, section).catch(() => null),
        ])

        let quizAvg = 0
        let hwAvg = 0
        let attendancePct = 0
        let overallGrade = 0
        let missingAssignments = 0
        let finalTaken = false

        if (gradePayload && typeof gradePayload === "object") {
          const display = resolveStudentGradeDisplay(gradePayload)
          overallGrade = display.totalScore
        }

        if (quizPayload && typeof quizPayload === "object") {
          const { quizHistory } = quizPayload as {
            quizHistory?: { attempts?: { percentage: number }[] }[]
          }
          const allScores: number[] = []
          for (const q of quizHistory || []) {
            const best = q.attempts?.reduce((max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0), 0) ?? 0
            if (best > 0) allScores.push(best)
          }
          quizAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0
        }

        if (homeworkPayload && typeof homeworkPayload === "object") {
          const { homeworkHistory, stats } = homeworkPayload as {
            homeworkHistory?: { status: string; attempts?: { percentage: number }[] }[]
            stats?: { overdue?: number; pending?: number }
          }
          const completed = (homeworkHistory || []).filter((h: { status: string }) => h.status === "completed")
          const scores = completed
            .map((h: { attempts?: { percentage: number }[] }) => {
              const best = h.attempts?.reduce((max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0), 0) ?? 0
              return best
            })
            .filter((s: number) => s > 0)
          hwAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
          missingAssignments = (stats?.overdue ?? 0) + (stats?.pending ?? 0)
        }

        if (attendancePayload && typeof attendancePayload === "object") {
          const { attendance } = attendancePayload as { attendance?: { attendance_percentage?: number } }
          attendancePct = Number(attendance?.attendance_percentage ?? 0)
        }

        if (finalsPayload && typeof finalsPayload === "object") {
          const data = finalsPayload as { finals?: { status?: string }[] }
          finalTaken = Array.isArray(data.finals) && data.finals.some((f) => f.status === "completed")
        }

        const generated: Insight[] = []

        if (quizAvg > 0 && hwAvg > 0 && quizAvg < hwAvg - 5) {
          const diff = Math.round(hwAvg - quizAvg)
          generated.push({
            id: "quiz-vs-hw",
            message: `Your quizzes are ${diff}% lower than homework. Focus on timed assessments and review.`,
            type: "tip",
            action: { label: "Practice Hub", href: "/student/dashboard-v2/practice" },
          })
        }

        if (attendancePct < 85 && attendancePct > 0) {
          generated.push({
            id: "attendance",
            message: "Attendance is impacting your grade. Aim for 90%+ to stay on track.",
            type: "warning",
            action: { label: "Attendance", href: "/student/dashboard-v2/attendance" },
          })
        }

        if (!finalTaken && overallGrade > 0) {
          const projected = overallGrade >= 88 ? "A-" : overallGrade >= 85 ? "B+" : overallGrade >= 80 ? "B" : "B-"
          generated.push({
            id: "final",
            message: `Scoring 88%+ on the final projects your grade to ${projected}.`,
            type: "info",
            action: { label: "Final Exams", href: "/student/dashboard-v2/final-exams" },
          })
        }

        if (missingAssignments > 0) {
          generated.push({
            id: "missing",
            message: `${missingAssignments} assignment${missingAssignments > 1 ? "s" : ""} ${missingAssignments > 1 ? "are" : "is"} missing. Complete them to improve your grade.`,
            type: "warning",
            action: { label: "Homework", href: "/student/dashboard-v2/homework" },
          })
        }

        if (overallGrade >= 90 && attendancePct >= 95 && missingAssignments === 0) {
          generated.push({
            id: "excellent",
            message: "Strong performance across the board. Keep it up!",
            type: "info",
          })
        }

        if (generated.length === 0) {
          generated.push({
            id: "default",
            message: "Track your grades and attendance to get personalized insights.",
            type: "info",
            action: { label: "View Grades", href: "/student/dashboard-v2/grades" },
          })
        }

        setInsights(generated)
      } catch (e) {
        console.error("[PerformanceInsightsCard] Failed:", e)
        setInsights([
          {
            id: "default",
            message: "Track your grades and attendance to get personalized insights.",
            type: "info",
            action: { label: "View Grades", href: "/student/dashboard-v2/grades" },
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchAndGenerate()
  }, [])

  if (loading) {
    return (
      <CardWrapper delay={0.2}>
        <div className="p-6 h-48 animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-2xl" />
      </CardWrapper>
    )
  }

  return (
    <CardWrapper delay={0.2}>
      <div className="flex h-full min-h-[280px] flex-col p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[var(--cc-accent)]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Academic Intelligence
          </h3>
        </div>
        <ul className="space-y-3">
          {insights.map((insight, i) => (
            <motion.li
              key={insight.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className={cn(
                "flex items-start gap-3 rounded-xl p-4",
                insight.type === "warning" && "bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20",
                insight.type === "tip" &&
                  cn(insightTheme.softBg, "border", insightTheme.border),
                insight.type === "info" && "border border-[var(--border)] bg-[var(--muted)]/40"
              )}
            >
              {insight.type === "warning" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-warning)]" />
              ) : insight.type === "tip" ? (
                <TrendingUp className={cn("mt-0.5 h-4 w-4 shrink-0", insightTheme.iconText)} />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--cc-text)]">{insight.message}</p>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className={cn(
                      "inline-flex items-center gap-1 mt-2 text-sm font-medium hover:underline",
                      insightTheme.iconText,
                    )}
                  >
                    {insight.action.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </CardWrapper>
  )
}
