"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { bindStudentActiveEnrollment } from "@/lib/student-course-switch-client"
import { studentSelectCoursePickerKey } from "@/lib/student-select-course"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { cn } from "@/lib/utils"
import { DrawerNavIcon } from "./DrawerNavIcon"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

type EnrollmentRow = {
  courseId: number
  courseCode: string
  courseTitle: string
  section: string
  studentRowId?: number | null
  sessionId?: number | null
  academicTermId?: number | null
  academicTermLabel?: string | null
  status?: string
}

const pickerKey = studentSelectCoursePickerKey

function codeLabel(row: EnrollmentRow): string {
  return row.courseCode.trim() || `Course ${row.courseId}`
}

/** Compact topbar label — prefer section code when enrolled in a specific section. */
function chipLabel(row: EnrollmentRow): string {
  const section = row.section.trim()
  if (section) return section
  return codeLabel(row)
}

function pickerLabel(row: EnrollmentRow): string {
  const section = row.section.trim()
  const term = row.academicTermLabel?.trim()
  const base = section ? `${codeLabel(row)} • ${section}` : codeLabel(row)
  return term ? `${base} (${term})` : base
}

function metaLabel(row: EnrollmentRow): string {
  const section = row.section.trim()
  const term = row.academicTermLabel?.trim()
  if (section && term) return `${section} • ${term}`
  return section || term || ""
}

function normalizeRow(row: Partial<EnrollmentRow> & { courseId?: number }): EnrollmentRow | null {
  const courseId = Number(row.courseId)
  if (!Number.isFinite(courseId) || courseId <= 0) return null
  return {
    courseId: Math.trunc(courseId),
    courseCode: String(row.courseCode ?? "").trim(),
    courseTitle: String(row.courseTitle ?? "").trim(),
    section: String(row.section ?? "").trim(),
    studentRowId: row.studentRowId ?? null,
    sessionId: row.sessionId ?? null,
    academicTermId: row.academicTermId ?? null,
    academicTermLabel: row.academicTermLabel ?? null,
    status: row.status,
  }
}

function patchStudentSessionEnrollments(rows: EnrollmentRow[]) {
  try {
    const sessionStr = localStorage.getItem("studentSession")
    if (!sessionStr) return
    const session = JSON.parse(sessionStr) as Record<string, unknown>
    session.enrollments = rows.map((row) => ({
      courseId: row.courseId,
      courseCode: row.courseCode,
      courseTitle: row.courseTitle,
      section: row.section,
      studentRowId: row.studentRowId,
      sessionId: row.sessionId,
      academicTermId: row.academicTermId,
      academicTermLabel: row.academicTermLabel,
    }))
    localStorage.setItem("studentSession", JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

function activeEnrollmentFromRows(rows: EnrollmentRow[]): EnrollmentRow | null {
  if (!rows.length) return null
  const session = getStudentData()
  const dbId = session?.databaseId ? Number.parseInt(String(session.databaseId), 10) : NaN
  if (Number.isFinite(dbId)) {
    const byRow = rows.find((row) => row.studentRowId === dbId)
    if (byRow) return byRow
  }
  const courseId = session?.courseId
  const section = session?.section?.trim()
  if (courseId != null && section) {
    const byCourseSection = rows.find(
      (row) => row.courseId === courseId && row.section.trim() === section,
    )
    if (byCourseSection) return byCourseSection
  }
  if (courseId != null) {
    return rows.find((row) => row.courseId === courseId) ?? rows[0]
  }
  return rows[0]
}

function enrollmentsFromSession(): EnrollmentRow[] {
  const student = getStudentData()
  if (!student) return []
  const seen = new Set<string>()
  const rows: EnrollmentRow[] = []
  const push = (raw: Partial<EnrollmentRow> | null | undefined) => {
    if (!raw) return
    const row = normalizeRow(raw)
    if (!row) return
    const key = pickerKey(row)
    if (seen.has(key)) return
    seen.add(key)
    rows.push(row)
  }
  if (Array.isArray(student.enrollments)) {
    for (const item of student.enrollments) push(item)
  }
  push({
    courseId: student.courseId,
    courseCode: student.courseCode,
    courseTitle: student.courseTitle,
    section: student.section ?? "",
  })
  return rows
}

export function StudentCourseSwitcher({ className }: { className?: string }) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>(() => enrollmentsFromSession())
  const [activeKey, setActiveKey] = useState<string>(() => {
    const rows = enrollmentsFromSession()
    const active = activeEnrollmentFromRows(rows)
    return active ? pickerKey(active) : rows[0] ? pickerKey(rows[0]) : ""
  })
  const [switching, setSwitching] = useState(false)

  const load = useCallback(() => {
    const fromSession = enrollmentsFromSession()
    if (fromSession.length > 0) {
      setEnrollments((current) => (current.length > 0 ? current : fromSession))
      const current = activeEnrollmentFromRows(fromSession)
      if (current) setActiveKey(pickerKey(current))
    }
    void studentApiFetch("/api/student/enrollments")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const rows = Array.isArray(json?.enrollments)
          ? (json.enrollments as EnrollmentRow[]).map((row) => normalizeRow(row)).filter((row): row is EnrollmentRow => row != null)
          : []
        const merged = rows.length > 0 ? rows : fromSession
        if (merged.length === 0) return
        setEnrollments(merged)
        patchStudentSessionEnrollments(merged)
        const active =
          activeEnrollmentFromRows(merged) ??
          normalizeRow((json?.activeEnrollment as EnrollmentRow) ?? {}) ??
          merged[0]
        if (active) setActiveKey(pickerKey(active))
      })
      .catch(() => {
        if (fromSession.length > 0) setEnrollments(fromSession)
      })
  }, [])

  useEffect(() => {
    load()
    const onSwitch = () => load()
    window.addEventListener(COURSE_SWITCH_EVENT, onSwitch)
    window.addEventListener("student-session-ready", onSwitch)
    return () => {
      window.removeEventListener(COURSE_SWITCH_EVENT, onSwitch)
      window.removeEventListener("student-session-ready", onSwitch)
    }
  }, [load])

  const active = useMemo(
    () => enrollments.find((row) => pickerKey(row) === activeKey) ?? enrollments[0] ?? null,
    [activeKey, enrollments],
  )

  if (!active) return null

  const chipTitle = [codeLabel(active), active.courseTitle, metaLabel(active)].filter(Boolean).join(" · ")
  const chipInner = (
    <>
      <DrawerNavIcon
        name="book-outline"
        size={15}
        color="var(--cc-accent-dark)"
        className="hidden shrink-0 min-[380px]:block"
      />
      <span className="min-w-0 truncate text-left text-[13px] font-semibold text-slate-900 dark:text-white">
        {chipLabel(active)}
      </span>
    </>
  )

  if (enrollments.length < 2) {
    return (
      <div
        className={cn(
          "inline-flex h-9 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5",
          "text-slate-900 dark:text-white",
          className,
        )}
        title={chipTitle}
        aria-label={chipTitle}
      >
        {chipInner}
      </div>
    )
  }

  const onChange = (value: string) => {
    if (value === "__manage__") {
      router.push("/auth/student/select-course")
      return
    }
    const next = enrollments.find((row) => pickerKey(row) === value)
    if (!next || switching) return
    if (pickerKey(next) === activeKey) return
    setSwitching(true)
    setActiveKey(value)
    void bindStudentActiveEnrollment({
      courseId: next.courseId,
      section: next.section,
      studentRowId: next.studentRowId,
    })
      .then((ok) => {
        if (!ok) {
          setActiveKey(pickerKey(active))
          return
        }
        router.refresh()
      })
      .finally(() => setSwitching(false))
  }

  return (
    <Select value={activeKey} onValueChange={onChange} disabled={switching}>
      <SelectTrigger
        aria-label="Switch course"
        className={cn(
          "h-9 w-auto max-w-[12rem] shrink-0 gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 shadow-none",
          "sm:max-w-[13rem]",
          "text-slate-900 focus:ring-1 focus:ring-[var(--cc-accent)]/30 dark:text-white",
          className,
        )}
        title={chipTitle}
      >
        {chipInner}
      </SelectTrigger>
      <SelectContent className="max-h-[min(360px,60vh)] rounded-xl bg-[var(--popover)] text-[var(--cc-text)]">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          My Courses
        </div>
        {enrollments.map((row) => {
          const key = pickerKey(row)
          const selected = key === activeKey
          return (
            <SelectItem key={key} value={key} className="rounded-lg">
              <span className="font-medium text-slate-900 dark:text-white">
                {selected ? "✓ " : ""}
                {pickerLabel(row)}
              </span>
              {row.courseTitle ? (
                <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">{row.courseTitle}</span>
              ) : null}
            </SelectItem>
          )
        })}
        {enrollments.length > 1 ? (
          <SelectItem value="__manage__" className="rounded-lg">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">View all courses…</span>
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}
