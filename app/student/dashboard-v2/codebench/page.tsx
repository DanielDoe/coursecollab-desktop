"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const CodeBenchHubDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/CodeBenchHubDashboardV2").then((m) => ({
      default: m.CodeBenchHubDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-0 flex-1" /> },
)

export default function DashboardV2CodebenchPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <CodeBenchHubDashboardV2 />
    </StudentDashboardModulePage>
  )
}
