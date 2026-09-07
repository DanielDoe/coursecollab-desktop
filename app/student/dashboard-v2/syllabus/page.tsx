"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const SyllabusDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/SyllabusDashboardV2").then((m) => ({
      default: m.SyllabusDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2SyllabusPage() {
  return (
    <StudentDashboardModulePage>
      <SyllabusDashboardV2 />
    </StudentDashboardModulePage>
  )
}
