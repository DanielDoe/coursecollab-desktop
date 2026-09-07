"use client"

import { RoleDashboardPage } from "@/components/dashboard-v2/RoleDashboardPage"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageStackClass } from "@/lib/dashboard-v2-layout"

export default function InstructorDashboardV2Page() {
  return (
    <PageEnter className={dashboardV2PageStackClass}>
      <RoleDashboardPage portal="faculty" />
    </PageEnter>
  )
}
