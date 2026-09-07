"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ProgressReviewDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/ProgressReviewDashboardV2").then((m) => ({
      default: m.ProgressReviewDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function ProgressReviewPage() {
  return (
    <StudentDashboardModulePage>
      <ProgressReviewDashboardV2 />
    </StudentDashboardModulePage>
  )
}
