"use client"

import { Suspense } from "react"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestCoverLetterPage } from "@/components/guest/career/GuestCoverLetterPage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

export default function Page() {
  return (
    <GuestModulePage>
      <Suspense fallback={<ModulePageSkeleton className="min-h-[320px]" />}>
        <GuestCoverLetterPage />
      </Suspense>
    </GuestModulePage>
  )
}
