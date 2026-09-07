"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { getStudentData } from "@/lib/auth"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

const ClassroomPointsV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/ClassroomPointsV2").then((m) => ({
      default: m.ClassroomPointsV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2ClassroomPointsPage() {
  const router = useRouter()
  const desktopChrome = isDesktopAppShell()
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

  const content =
    loading || !studentId ? (
      <ModulePageSkeleton className="min-h-[420px]" />
    ) : (
      <ClassroomPointsV2 studentId={studentId} studentSession={studentSection} embedInDashboard />
    )

  if (desktopChrome) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">{content}</div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">{content}</div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
