"use client"

import { BookOpen, ChevronRight } from "lucide-react"
import { CcBookLoader } from "@/components/ui/cc-book-loader"
import type { StudentSelectCourseOption } from "@/lib/student-select-course"
import { studentSelectCoursePickerKey } from "@/lib/student-select-course"
import { desktopAuth, DesktopAuthBackLink } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"

function courseDisplayTitle(course: StudentSelectCourseOption) {
  const title = course.courseTitle?.trim()
  if (title && title !== course.courseCode?.trim()) return title
  return course.courseCode?.trim() || "Course"
}

function courseMetaLine(course: StudentSelectCourseOption) {
  return [course.courseCode, course.section, course.academicTermLabel].filter(Boolean).join(" · ")
}

function CourseRow({
  course,
  loading,
  onSelect,
  isLast,
  compact = false,
}: {
  course: StudentSelectCourseOption
  loading?: boolean
  onSelect: () => void
  isLast?: boolean
  compact?: boolean
}) {
  const title = courseDisplayTitle(course)
  const meta = courseMetaLine(course)

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3.5 text-left transition-colors",
        compact ? "rounded-lg px-3.5 py-3" : "px-3.5 py-3.5",
        "hover:bg-[var(--cc-accent-soft)] active:bg-[color-mix(in_srgb,var(--cc-accent-soft)_70%,var(--cc-surface))]",
        !isLast && "border-b border-[var(--border)]",
        loading && "pointer-events-none opacity-70",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
        <BookOpen className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--cc-text)]">{title}</span>
        {meta ? (
          <span className="mt-0.5 block truncate text-[13px] text-[var(--cc-text-secondary)]">{meta}</span>
        ) : null}
      </span>
      {!compact ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden /> : null}
    </button>
  )
}

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
  const singleCourse = enrollments.length === 1 ? enrollments[0] : null

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className={desktopAuth.title}>
          {singleCourse ? "Confirm your course" : "Select a course"}
        </h2>
        <p className={desktopAuth.subtitle}>
          {singleCourse
            ? "This is your active enrollment. Continue to open your dashboard."
            : "You're enrolled in multiple courses. Choose one — lectures, Cora, grades, and all modules follow this selection."}
        </p>
      </div>

      {singleCourse ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--cc-background)]">
          <CourseRow
            course={singleCourse}
            loading={loading}
            onSelect={() => onSelect(singleCourse)}
            compact
          />
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--cc-background)]"
          role="list"
        >
          {enrollments.map((course, index) => (
            <div key={studentSelectCoursePickerKey(course)} role="listitem">
              <CourseRow
                course={course}
                loading={loading}
                onSelect={() => onSelect(course)}
                isLast={index === enrollments.length - 1}
              />
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className={cn(desktopAuth.alert, "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300")}>
          {error}
        </p>
      ) : null}

      {singleCourse ? (
        <div className={desktopAuth.actionStack}>
          <button
            type="button"
            disabled={loading}
            onClick={() => onSelect(singleCourse)}
            className={cn(desktopAuth.button, "h-10 text-[14px]")}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <CcBookLoader size="sm" label="" />
                Opening dashboard…
              </span>
            ) : (
              "Continue to dashboard"
            )}
          </button>
          <DesktopAuthBackLink href="/auth/student" label="Back to sign in" />
        </div>
      ) : (
        <>
          {loading ? (
            <div className="flex justify-center py-1">
              <CcBookLoader size="sm" label="Opening course" />
            </div>
          ) : null}
          <div className={desktopAuth.actionStack}>
            <DesktopAuthBackLink href="/auth/student" label="Back to sign in" />
          </div>
        </>
      )}
    </div>
  )
}
