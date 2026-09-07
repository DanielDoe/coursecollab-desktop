"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { CourseSyllabusPanel } from "@/components/syllabus/CourseSyllabusPanel"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"

export function SyllabusDashboardV2() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
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
      setStudentId(databaseId || session.databaseId?.toString() || session.id?.toString() || "")
    } catch {
      router.push("/student/login")
    } finally {
      setMounted(true)
    }
  }, [router])

  return (
    <StudentModuleHubLayout
      moduleId="syllabus"
      title="Syllabus"
      metaLine="Course outline, policies, and key dates"
      metaSuffix="official course reference"
      hideSideMenu
      loading={!mounted || !studentId}
      menuView="syllabus"
      onMenuSelect={() => {}}
      menuItems={[{ id: "syllabus", label: "Syllabus", icon: BookOpen }]}
    >
      {studentId ? (
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <CourseSyllabusPanel
            courseId={0}
            mode="student"
            fetchUrl="/api/student/syllabus"
            studentId={studentId}
            buildHeaders={() => ({ "x-student-id": studentId })}
          />
        </div>
      ) : null}
    </StudentModuleHubLayout>
  )
}
