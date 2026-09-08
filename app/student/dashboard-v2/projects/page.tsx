"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ProjectsDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/ProjectsDashboardV2").then((m) => ({
      default: m.ProjectsDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2ProjectsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <ProjectsDashboardV2 />
    </StudentDashboardModulePage>
  )
}
