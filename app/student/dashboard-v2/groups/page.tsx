"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const GroupsDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/GroupsDashboardV2").then((m) => ({
      default: m.GroupsDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2GroupsPage() {
  return (
    <StudentDashboardModulePage>
      <GroupsDashboardV2 />
    </StudentDashboardModulePage>
  )
}
