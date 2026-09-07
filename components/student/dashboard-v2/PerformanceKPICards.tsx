"use client"

import { useState, useEffect, useMemo } from "react"
import {
  GraduationCap,
  ClipboardList,
  BookOpen,
  CalendarCheck,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getStudentAuthHeaders, resolveStudentDatabaseId, resolveStudentDisplayId, resolveStudentSection, studentApiFetch } from "@/lib/auth"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { themeChromeFamily } from "@/lib/appearance/module-chrome"
import { contentThumbsForFamily, type SolidListThumb } from "@/lib/student-color-hunt-theme"
import { inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { formatKpiPercent, roundKpiNumber } from "@/lib/dashboard-v2/format-kpi-value"

interface PerformanceData {
  overallGrade: number
  letterGrade: string
  gradeIsProvisional: boolean
  gradeChange: number
  quizAverage: number
  classQuizAverage: number
  homeworkAverage: number
  missingAssignments: number
  attendancePct: number
  classesMissed: number
  riskLevel: "low" | "moderate" | "high"
  riskReason: string
}

const RISK_LABEL = {
  low: "Low Risk",
  moderate: "Moderate Risk",
  high: "High Risk",
} as const

function thumbForIndex(
  thumbs: readonly string[],
  index: number,
  isDark: boolean,
  deep: string,
): SolidListThumb {
  const fill = thumbs[((index % thumbs.length) + thumbs.length) % thumbs.length] ?? thumbs[0]!
  return { fill, icon: inkOnFillForMode(fill, isDark, deep) }
}

export function PerformanceKPICards() {
  const { themeId, tokens, isDark } = useAppearance()
  const familyThumbs = useMemo(() => {
    const family = themeChromeFamily(themeId)
    return contentThumbsForFamily(family)
  }, [themeId])
  const deep = tokens.accentHover || tokens.accent

  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const displayId = resolveStudentDisplayId()
    const section = resolveStudentSection()

    if (!dbId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const homeworkStudentId = displayId || dbId
        const [gradeRes, quizRes, homeworkRes, attendanceRes] = await Promise.all([
          studentApiFetch(`/api/grades/student?studentId=${dbId}&session=${section}&recalculate=true`, {
            headers: getStudentAuthHeaders(),
          }),
          studentApiFetch(`/api/student/quiz-history?studentId=${dbId}`, { headers: getStudentAuthHeaders() }),
          homeworkStudentId && section
            ? fetch(
                `/api/student/homework-history?studentId=${homeworkStudentId}&session=${section}`,
                { headers: getStudentAuthHeaders() },
              )
            : Promise.resolve(null),
          fetch(`/api/attendance/score?studentId=${dbId}`),
        ])

        let overallGrade = 0
        let letterGrade = "—"
        let gradeChange = 0
        let quizAverage = 0
        let classQuizAverage = 80
        let homeworkAverage = 0
        let missingAssignments = 0
        let attendancePct = 0
        let classesMissed = 0
        let gradeIsProvisional = false

        if (gradeRes.ok) {
          const gradePayload = await gradeRes.json()
          const display = resolveStudentGradeDisplay(gradePayload)
          overallGrade = roundKpiNumber(display.totalScore)
          letterGrade = display.letterLabel
          gradeIsProvisional = display.gradeIsProvisional
          const { classAverages } = gradePayload
          if (classAverages?.avg_quiz != null) {
            classQuizAverage = roundKpiNumber(Number(classAverages.avg_quiz))
          }
        }

        if (quizRes.ok) {
          const { quizHistory } = await quizRes.json()
          const allScores: number[] = []
          for (const q of quizHistory || []) {
            const best =
              q.attempts?.reduce(
                (max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0),
                0,
              ) ?? 0
            if (best > 0) allScores.push(best)
          }
          quizAverage =
            allScores.length > 0
              ? roundKpiNumber(allScores.reduce((a, b) => a + b, 0) / allScores.length)
              : 0
        }

        if (homeworkRes?.ok) {
          const { homeworkHistory, stats } = await homeworkRes.json()
          const completed = (homeworkHistory || []).filter(
            (h: { status: string }) => h.status === "completed",
          )
          const scores = completed
            .map((h: { attempts?: { percentage: number }[] }) => {
              const best =
                h.attempts?.reduce(
                  (max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0),
                  0,
                ) ?? 0
              return best
            })
            .filter((s: number) => s > 0)
          homeworkAverage =
            scores.length > 0
              ? roundKpiNumber(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
              : 0
          missingAssignments = (stats?.overdue ?? 0) + (stats?.pending ?? 0)
        }

        if (attendanceRes.ok) {
          const { attendance } = await attendanceRes.json()
          if (attendance) {
            attendancePct = roundKpiNumber(Number(attendance.attendance_percentage ?? 0))
            const scored = Number(attendance.sessions_scored_so_far ?? attendance.total_classes ?? 0)
            const attended = Number(attendance.classes_attended ?? 0)
            classesMissed = Math.max(0, scored - attended)
          }
        }

        let riskLevel: PerformanceData["riskLevel"] = "low"
        let riskReason = "Grades and attendance on track."

        if (overallGrade >= 85 && attendancePct >= 90 && missingAssignments === 0) {
          riskLevel = "low"
          riskReason = "Grades and attendance on track."
        } else if (overallGrade >= 70 && attendancePct >= 80) {
          riskLevel = "moderate"
          const reasons: string[] = []
          if (overallGrade < 85) reasons.push("grade below 85%")
          if (attendancePct < 90) reasons.push("attendance below 90%")
          if (missingAssignments > 0) reasons.push(`${missingAssignments} missing`)
          riskReason = reasons.length ? `Focus on: ${reasons.join(", ")}` : "Room to improve."
        } else {
          riskLevel = "high"
          const reasons: string[] = []
          if (overallGrade < 70) reasons.push("grade below 70%")
          if (attendancePct < 80) reasons.push("attendance below 80%")
          if (missingAssignments > 0) reasons.push(`${missingAssignments} missing`)
          riskReason = `Action needed: ${reasons.join(", ")}`
        }

        setData({
          overallGrade,
          letterGrade,
          gradeIsProvisional,
          gradeChange,
          quizAverage,
          classQuizAverage,
          homeworkAverage,
          missingAssignments,
          attendancePct,
          classesMissed,
          riskLevel,
          riskReason,
        })
      } catch (e) {
        console.error("[PerformanceKPICards] Failed to fetch:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[7.5rem] animate-pulse rounded-2xl bg-[var(--muted)]/40 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]"
          />
        ))}
      </div>
    )
  }

  if (!data) return null

  const riskThumbIndex = data.riskLevel === "high" ? 6 : data.riskLevel === "moderate" ? 4 : 2

  const cards: Array<{
    key: string
    label: string
    icon: LucideIcon
    value: string
    footer: string
    trend?: number
    thumbIndex: number
    span?: boolean
  }> = [
    {
      key: "grade",
      label: "Overall Grade",
      icon: GraduationCap,
      value: `${formatKpiPercent(data.overallGrade)}${data.gradeIsProvisional ? "*" : ""}`,
      footer: data.letterGrade,
      trend: roundKpiNumber(data.gradeChange),
      thumbIndex: 0,
    },
    {
      key: "quiz",
      label: "Quiz Average",
      icon: ClipboardList,
      value: formatKpiPercent(data.quizAverage),
      footer: `Class avg ${formatKpiPercent(data.classQuizAverage)}`,
      trend: roundKpiNumber(data.quizAverage - data.classQuizAverage),
      thumbIndex: 1,
    },
    {
      key: "hw",
      label: "Homework",
      icon: BookOpen,
      value: formatKpiPercent(data.homeworkAverage),
      footer: data.missingAssignments > 0 ? `${data.missingAssignments} missing` : "All done",
      thumbIndex: 2,
    },
    {
      key: "attendance",
      label: "Attendance",
      icon: CalendarCheck,
      value: formatKpiPercent(data.attendancePct),
      footer: data.classesMissed > 0 ? `${data.classesMissed} missed` : "Perfect",
      thumbIndex: 3,
    },
    {
      key: "risk",
      label: "Risk Level",
      icon: AlertTriangle,
      value: RISK_LABEL[data.riskLevel],
      footer: data.riskReason,
      thumbIndex: riskThumbIndex,
      span: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:gap-x-3 sm:gap-y-5 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((config) => (
        <ThemeKpiCard
          key={config.key}
          label={config.label}
          value={config.value}
          icon={config.icon}
          thumb={thumbForIndex(familyThumbs, config.thumbIndex, isDark, deep)}
          footer={config.footer}
          trend={config.trend}
          className={cn(config.span && "col-span-2 md:col-span-1")}
        />
      ))}
    </div>
  )
}
