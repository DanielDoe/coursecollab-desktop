"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck } from "lucide-react"
import { SystemErrorBoundary } from "@/components/system-error-boundary"
import { CourseEvaluationPanel } from "@/components/student/course-evaluation-panel"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { getStudentData } from "@/lib/auth"

export function CourseEvaluationDashboardV2() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<number | null>(null)
  const [session, setSession] = useState("ALL")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const data = getStudentData()
    const dbId = data?.databaseId ?? sessionStorage.getItem("studentDatabaseId")
    const section = data?.section ?? sessionStorage.getItem("studentSection") ?? "ALL"
    if (!dbId) {
      router.push("/student/login")
      return
    }
    setStudentId(parseInt(String(dbId), 10))
    setSession(section || "ALL")
    setLoading(false)
  }, [router])

  return (
    <StudentModuleHubLayout
      moduleId="course-evaluation"
      title="Course Evaluation"
      metaLine="Self-assessment and engagement proof for your instructor"
      metaSuffix="submit when your instructor opens the window"
      hideSideMenu
      loading={loading || !studentId}
      menuView="evaluation"
      onMenuSelect={() => {}}
      menuItems={[{ id: "evaluation", label: "Evaluation", icon: ClipboardCheck }]}
    >
      {studentId ? (
        <SystemErrorBoundary moduleName="Course Evaluation" fallbackTitle="Course evaluation">
          <CourseEvaluationPanel studentId={studentId} session={session} />
        </SystemErrorBoundary>
      ) : null}
    </StudentModuleHubLayout>
  )
}
