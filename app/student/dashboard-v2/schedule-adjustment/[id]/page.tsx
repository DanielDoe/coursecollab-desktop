"use client"

import dynamic from "next/dynamic"
import { use } from "react"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ScheduleAdjustmentDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/ScheduleAdjustmentDashboardV2").then((m) => ({
      default: m.ScheduleAdjustmentDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function StudentScheduleAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <StudentDashboardModulePage>
      <ScheduleAdjustmentDashboardV2 requestId={Number(id)} />
    </StudentDashboardModulePage>
  )
}
