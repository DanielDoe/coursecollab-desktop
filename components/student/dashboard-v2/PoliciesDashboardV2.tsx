"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { studentApiFetch } from "@/lib/auth"
import {
  StudentCoursePoliciesPanel,
  type StudentCoursePoliciesData,
} from "@/components/governance/StudentCoursePoliciesPanel"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"

export function PoliciesDashboardV2() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<StudentCoursePoliciesData | null>(null)

  useEffect(() => {
    const session = localStorage.getItem("studentSession")
    if (!session) {
      router.push("/student/login")
      return
    }
    try {
      const parsed = JSON.parse(session)
      const id = sessionStorage.getItem("studentDatabaseId") || String(parsed.databaseId ?? parsed.id ?? "")
      setStudentId(id)
    } catch {
      router.push("/student/login")
    }
  }, [router])

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    setErr(null)
    void studentApiFetch("/api/student/course-policies", {
      headers: { "x-student-id": studentId },
    })
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || "Failed to load policies")
        setData(j)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load policies"))
      .finally(() => setLoading(false))
  }, [studentId])

  const metaLine = data?.source_label
    ? `Source: ${data.source_label}`
    : "Attendance, assessments, projects, and platform rules"

  return (
    <StudentModuleHubLayout
      moduleId="policies"
      title="Policies"
      metaLine={metaLine}
      metaSuffix="course and platform expectations"
      hideSideMenu
      loading={!studentId || loading}
      menuView="policies"
      onMenuSelect={() => {}}
      menuItems={[{ id: "policies", label: "Course policies", icon: ShieldCheck }]}
    >
      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/40 bg-red-50/90 dark:bg-red-950/25 px-3 py-2.5">
          {err}
        </p>
      ) : data ? (
        <StudentCoursePoliciesPanel data={data} />
      ) : null}
    </StudentModuleHubLayout>
  )
}
