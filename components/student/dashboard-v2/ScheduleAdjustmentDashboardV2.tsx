"use client"

import { usePathname } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { StudentScheduleAdjustmentPanel } from "@/components/schedule-adjustment/StudentScheduleAdjustmentPanel"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"

type Props = {
  requestId?: number
}

export function ScheduleAdjustmentDashboardV2({ requestId }: Props) {
  const pathname = usePathname()
  const isDetail = requestId != null || /\/schedule-adjustment\/\d+/.test(pathname ?? "")

  return (
    <StudentModuleHubLayout
      moduleId="schedule-adjustment"
      title="Schedule Adjustment"
      metaLine={
        isDetail
          ? "Review availability, consent, and proposed meeting times"
          : "Active polls and consent for class time changes"
      }
      metaSuffix="respond when your instructor opens a poll"
      hideSideMenu={isDetail}
      menuView={isDetail ? "detail" : "active"}
      onMenuSelect={() => {}}
      menuItems={[{ id: "active", label: "Active polls", icon: CalendarClock }]}
    >
      <StudentScheduleAdjustmentPanel requestId={requestId} hubLayout />
    </StudentModuleHubLayout>
  )
}
