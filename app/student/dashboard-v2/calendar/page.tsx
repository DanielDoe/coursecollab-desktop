"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const CalendarDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/CalendarDashboardV2").then((m) => ({
      default: m.CalendarDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2CalendarPage() {
  return (
    <StudentDashboardModulePage>
      <CalendarDashboardV2 />
    </StudentDashboardModulePage>
  )
}
