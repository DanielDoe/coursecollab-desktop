"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ForumHub = dynamic(() => import("./forum-hub"), {
  loading: () => <ModulePageSkeleton className="min-h-[480px]" />,
})

export default function DashboardV2ForumPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton className="min-h-[480px]" />}>
      <StudentDashboardModulePage>
        <ForumHub />
      </StudentDashboardModulePage>
    </Suspense>
  )
}
