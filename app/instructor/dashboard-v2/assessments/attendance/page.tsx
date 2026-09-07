"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { InstructorAttendanceContent } from "@/components/attendance/instructor-attendance-content"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function AssessmentsAttendancePage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <InstructorAttendanceContent embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
