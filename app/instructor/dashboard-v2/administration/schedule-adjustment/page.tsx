"use client"

import { Suspense } from "react"
import { CalendarClock } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorScheduleAdjustmentPanel } from "@/components/schedule-adjustment/InstructorScheduleAdjustmentPanel"

export default function ScheduleAdjustmentPage() {
  return (
    <InstructorAdministrationModulePage
      title="Schedule Adjustment"
      description="Coordinate class schedule changes with availability polling, department confirmation, and student consent."
      icon={CalendarClock}
      moduleId="course-settings"
      showHeader={false}
    >
      <Suspense fallback={<p className="flex min-h-[40vh] w-full items-center justify-center text-sm text-[var(--muted-foreground)]">Loading schedule adjustments…</p>}>
        <InstructorScheduleAdjustmentPanel />
      </Suspense>
    </InstructorAdministrationModulePage>
  )
}
