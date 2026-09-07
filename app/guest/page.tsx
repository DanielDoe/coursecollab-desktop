"use client"

import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { GuestHomeDashboard } from "@/components/guest/GuestHomeDashboard"

export default function GuestHomePage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <GuestHomeDashboard />
    </PageEnter>
  )
}
