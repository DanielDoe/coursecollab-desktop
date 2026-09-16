"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { SystemErrorBoundary } from "@/components/system-error-boundary"
import { CourseEvaluationPanel } from "@/components/student/course-evaluation-panel"
import { getStudentData } from "@/lib/auth"

export default function CourseEvaluationPage() {
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

  if (loading || !studentId) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700 border-t-sky-600 dark:border-t-sky-400" />
      </div>
    )
  }

  return (
    <PageEnter className="pb-8">
      <SystemErrorBoundary moduleName="Course Evaluation" fallbackTitle="Course evaluation">
        <CourseEvaluationPanel studentId={studentId} session={session} />
      </SystemErrorBoundary>
    </PageEnter>
  )
}
