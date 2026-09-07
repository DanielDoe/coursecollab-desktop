"use client"

import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestReportBugPage } from "@/components/guest/support/GuestReportBugPage"

export default function GuestReportBugRoute() {
  return (
    <GuestModulePage bare>
      <GuestReportBugPage />
    </GuestModulePage>
  )
}
