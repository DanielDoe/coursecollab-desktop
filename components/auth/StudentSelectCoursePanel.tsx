"use client"

import { Loader2 } from "lucide-react"
import type { StudentSelectCourseOption } from "@/lib/student-select-course"
import { studentSelectCoursePickerKey } from "@/lib/student-select-course"

export function StudentSelectCoursePanel({
  enrollments,
  loading,
  error,
  onSelect,
}: {
  enrollments: StudentSelectCourseOption[]
  loading?: boolean
  error?: string
  onSelect: (course: StudentSelectCourseOption) => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select a Course</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {enrollments.length > 1
            ? "You are enrolled in multiple courses. Choose one to continue. Lectures, Cora, grades, and every course module follow this selection."
            : "This is your active course. Continue to open the dashboard."}
        </p>
      </div>
      <div className="space-y-2">
        {enrollments.map((course) => (
          <button
            key={studentSelectCoursePickerKey(course)}
            type="button"
            disabled={loading}
            onClick={() => onSelect(course)}
            className="w-full rounded-2xl border border-slate-200/80 dark:border-white/10 px-4 py-4 text-left hover:border-violet-400 dark:hover:border-violet-500/50 transition-colors"
          >
            <span className="font-semibold text-slate-900 dark:text-white">{course.courseTitle}</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              {[course.courseCode, course.section, course.academicTermLabel].filter(Boolean).join(" • ")}
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
      {loading ? (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      ) : null}
    </div>
  )
}
