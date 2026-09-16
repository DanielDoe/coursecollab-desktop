"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Loader2 } from "lucide-react"
import {
  StudentCoursePoliciesPanel,
  type StudentCoursePoliciesData,
} from "@/components/governance/StudentCoursePoliciesPanel"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"

export default function CoursePoliciesPage() {
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

  if (!studentId || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent-dark)]" />
      </div>
    )
  }

  if (err || !data) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/40 bg-red-50/90 dark:bg-red-950/25 px-3 py-2.5">
        {err ?? "Failed to load course policies"}
      </p>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-w-0 pb-8"
    >
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <StudentCoursePoliciesPanel data={data} />
        </div>
      </EmbedModuleCard>
    </motion.div>
  )
}
