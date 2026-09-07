"use client"

import { Suspense } from "react"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestResumeMatchPage } from "@/components/guest/career/GuestResumeMatchPage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

export default function Page() {
  return (
    <GuestModulePage>
      <Suspense fallback={<ModulePageSkeleton className="min-h-[320px]" />}>
        <GuestResumeMatchPage />
      </Suspense>
    </GuestModulePage>
  )
}
