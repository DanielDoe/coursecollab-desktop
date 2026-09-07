"use client"

import { useEffect, useState } from "react"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"

interface GradesQuickSummaryProps {
  studentId: number
  session: string
  className?: string
}

export function GradesQuickSummary({ studentId, session, className }: GradesQuickSummaryProps) {
  const [grade, setGrade] = useState<{ total: number; letter: string; provisional: boolean } | null>(null)

  useEffect(() => {
    studentApiFetch(`/api/grades/student?studentId=${studentId}&session=${session}`, {
      headers: getStudentAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.grade) {
          const display = resolveStudentGradeDisplay(data)
          setGrade({
            total: display.totalScore,
            letter: display.letterLabel,
            provisional: display.gradeIsProvisional,
          })
        }
      })
      .catch(() => {})
  }, [studentId, session])

  if (!grade) return null

  const colorClass =
    grade.total >= 90
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/30"
      : grade.total >= 80
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/30"
      : grade.total >= 70
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/30"
      : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/30"

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        colorClass,
        className
      )}
    >
      <GraduationCap className="h-4 w-4 shrink-0 opacity-80" />
      <span className="text-sm font-semibold tabular-nums">
        {grade.total.toFixed(1)}%{grade.provisional ? " so far" : ""}
      </span>
      <span className="text-slate-400 dark:text-slate-400">·</span>
      <span className="text-sm font-bold text-slate-900 dark:text-white">{grade.letter}</span>
    </div>
  )
}
