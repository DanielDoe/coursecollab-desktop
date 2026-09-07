"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { InstructorCourseNotesPanel } from "@/components/instructor/course-notes/instructor-course-notes-panel"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function ContentCourseNotesPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <InstructorCourseNotesPanel />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
