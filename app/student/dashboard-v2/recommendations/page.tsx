"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const RecommendationsDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/RecommendationsDashboardV2").then((m) => ({
      default: m.RecommendationsDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function StudentDashboardRecommendationsPage() {
  return (
    <StudentDashboardModulePage>
      <RecommendationsDashboardV2 />
    </StudentDashboardModulePage>
  )
}
