"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const StudentAttendanceOverviewV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/StudentAttendanceOverviewV2").then((m) => ({
      default: m.StudentAttendanceOverviewV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

export default function DashboardV2AttendancePage() {
  return <StudentAttendanceOverviewV2 />
}
