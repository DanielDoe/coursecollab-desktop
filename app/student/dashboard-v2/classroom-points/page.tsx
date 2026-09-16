"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { getStudentData } from "@/lib/auth"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ClassroomPointsV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/ClassroomPointsV2").then((m) => ({
      default: m.ClassroomPointsV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

export default function DashboardV2ClassroomPointsPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentSection, setStudentSection] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getStudentData()
    const dbId = session?.databaseId ?? sessionStorage.getItem("studentDatabaseId")
    const rosterId = session?.id ?? sessionStorage.getItem("studentId")
    const section = session?.section ?? sessionStorage.getItem("studentSection") ?? ""

    if (!rosterId || !dbId) {
      router.push("/student/login")
      return
    }

    setStudentId(Number.parseInt(dbId, 10))
    setStudentSection(section)
    setLoading(false)
  }, [router])

  if (loading || !studentId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)]", studentModuleSpinnerClass("classroom-points"))} />
      </div>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-3 sm:p-4 md:p-5">
          <ClassroomPointsV2 studentId={studentId} studentSession={studentSection} embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
