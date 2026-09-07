"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const StudentAttendanceAnalyticsV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/StudentAttendanceAnalyticsV2").then((m) => ({
      default: m.StudentAttendanceAnalyticsV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

export default function DashboardV2AttendanceAnalyticsPage() {
  return <StudentAttendanceAnalyticsV2 />
}
