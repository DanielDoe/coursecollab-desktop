"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const OfficeHoursDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/OfficeHoursDashboardV2").then((m) => ({
      default: m.OfficeHoursDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2OfficeHoursPage() {
  return (
    <StudentDashboardModulePage>
      <OfficeHoursDashboardV2 />
    </StudentDashboardModulePage>
  )
}
