"use client"

import { Suspense } from "react"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestResumeOptimizePage } from "@/components/guest/career/GuestResumeOptimizePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

export default function Page() {
  return (
    <GuestModulePage>
      <Suspense fallback={<ModulePageSkeleton className="min-h-[320px]" />}>
        <GuestResumeOptimizePage />
      </Suspense>
    </GuestModulePage>
  )
}
