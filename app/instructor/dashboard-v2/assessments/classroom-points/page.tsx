"use client"

import { useRef, useState } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import {
  InstructorClassroomPoints,
  type ClassroomPointsNavSection,
} from "@/components/instructor-classroom-points"
import { ClipboardList, BarChart3, Clock, History, Users, Settings } from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

const SECTIONS: {
  id: ClassroomPointsNavSection
  label: string
  icon: typeof ClipboardList
}[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "code-submissions", label: "Assignments", icon: ClipboardList },
  { id: "pending-approvals", label: "Pending Approvals", icon: Clock },
  { id: "recent-awards", label: "Recent Awards", icon: History },
  { id: "students", label: "Leaderboard", icon: Users },
  { id: "configuration", label: "Configuration", icon: Settings },
]

export default function AssessmentsClassroomPointsPage() {
  const refreshRef = useRef<(() => void) | null>(null)
  const [activeSection, setActiveSection] = useState<ClassroomPointsNavSection>("overview")

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <FacultyModuleSplitLayout
            menu={
              <FacultyModuleSideMenu
                moduleId="classroom-points"
                title="Classroom Points"
                accent="theme"
                activeId={activeSection}
                onSelect={(id) => setActiveSection(id as ClassroomPointsNavSection)}
                items={SECTIONS}
              />
            }
          >
            <InstructorClassroomPoints onRefreshRef={refreshRef} activeSection={activeSection} />
          </FacultyModuleSplitLayout>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
