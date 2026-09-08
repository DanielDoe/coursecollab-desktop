"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const MessagesDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/MessagesDashboardV2").then((m) => ({
      default: m.MessagesDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[480px]" /> },
)

export default function StudentMessagesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton className="min-h-[480px]" />}>
      <StudentDashboardModulePage scrollMode="panel">
        <MessagesDashboardV2 />
      </StudentDashboardModulePage>
    </Suspense>
  )
}
