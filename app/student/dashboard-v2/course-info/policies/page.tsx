"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const PoliciesDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PoliciesDashboardV2").then((m) => ({
      default: m.PoliciesDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function CoursePoliciesPage() {
  return (
    <StudentDashboardModulePage>
      <PoliciesDashboardV2 />
    </StudentDashboardModulePage>
  )
}
