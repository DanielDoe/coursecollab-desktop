"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { StudentSelectCoursePanel } from "@/components/auth/StudentSelectCoursePanel"
import {
  DesktopAuthPanel,
  DesktopAuthPanelBody,
  DesktopAuthPanelCard,
} from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthStagger } from "@/components/auth/desktop-auth-motion"
import { DesktopAuthLoading } from "@/components/auth/DesktopAuthLoading"
import { getStudentData, isStudentAuthenticated } from "@/lib/auth"
import { resolveStudentPostLoginPath, syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { bindStudentActiveEnrollment } from "@/lib/student-course-switch-client"
import { studentApiFetch } from "@/lib/auth"
import { studentEnrollmentCount, type StudentSelectCourseOption } from "@/lib/student-select-course"
import { useAuth } from "@/lib/auth-context"
import { tryRestoreStudentSessionFromRefresh } from "@/lib/student-session-restore-client"

export default function StudentSelectCoursePage() {
  const router = useRouter()
  const { university } = useAuth()
  const [enrollments, setEnrollments] = useState<StudentSelectCourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isStudentAuthenticated()) {
        const restored = await tryRestoreStudentSessionFromRefresh()
        if (!restored || !isStudentAuthenticated()) {
          router.replace("/auth/student")
          return
        }
      }
      const session = getStudentData()
      if (!session) {
        router.replace("/auth/student")
        return
      }
      try {
        const res = await studentApiFetch("/api/student/enrollments")
        const json = res.ok ? await res.json() : null
        const rows = (Array.isArray(json?.enrollments) ? json.enrollments : session.enrollments ?? []) as
          StudentSelectCourseOption[]
        if (cancelled) return
        if (rows.length === 0) {
          router.replace("/student/dashboard-v2")
          return
        }
        setEnrollments(rows)
      } catch {
        if (cancelled) return
        const fallback = (session.enrollments ?? []) as StudentSelectCourseOption[]
        if (studentEnrollmentCount(fallback) === 0) {
          router.replace("/student/dashboard-v2")
          return
        }
        setEnrollments(fallback)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const continueAfterPick = async () => {
    const session = getStudentData()
    const appearanceSetupCompleted = session?.databaseId
      ? await syncAppearanceSetupFromServer(session.databaseId)
      : true
    router.replace(
      resolveStudentPostLoginPath({
        studentDbId: session?.databaseId ?? session?.id ?? "",
        hasChangedPassword: true,
        appearanceSetupCompleted,
        courseSelectionCompleted: true,
      }),
    )
  }

  const onSelect = async (course: StudentSelectCourseOption) => {
    setSaving(true)
    setError("")
    const current = getStudentData()
    const sameCourse =
      course.studentRowId != null &&
      current?.databaseId != null &&
      String(course.studentRowId) === String(current.databaseId)
    if (sameCourse) {
      await continueAfterPick()
      return
    }
    const ok = await bindStudentActiveEnrollment({
      courseId: course.courseId,
      section: course.section,
      studentRowId: course.studentRowId,
      sessionId: course.sessionId,
      academicTermId: course.academicTermId,
    })
    if (!ok) {
      setError("Could not open that course. Try again.")
      setSaving(false)
      return
    }
    await continueAfterPick()
  }

  void university

  return (
    <DesktopAuthShell wide sidebarTagline="Choose the course you want to work in.">
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard className="p-5">
            {loading ? (
              <DesktopAuthLoading label="Loading your courses" compact />
            ) : (
              <DesktopAuthStagger>
                <StudentSelectCoursePanel
                  enrollments={enrollments}
                  loading={saving}
                  error={error}
                  onSelect={(course) => void onSelect(course)}
                />
              </DesktopAuthStagger>
            )}
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
