"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const TimelineDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/TimelineDashboardV2").then((m) => ({
      default: m.TimelineDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function SemesterTimelinePage() {
  return (
    <StudentDashboardModulePage>
      <TimelineDashboardV2 />
    </StudentDashboardModulePage>
  )
}
