"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const StudentAttendanceHistoryV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/StudentAttendanceHistoryV2").then((m) => ({
      default: m.StudentAttendanceHistoryV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

export default function DashboardV2AttendanceHistoryPage() {
  return <StudentAttendanceHistoryV2 />
}
