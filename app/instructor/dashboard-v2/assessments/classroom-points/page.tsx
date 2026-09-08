"use client"

import { useRef, useState } from "react"
import {
  InstructorClassroomPoints,
  type ClassroomPointsNavSection,
} from "@/components/instructor-classroom-points"
import { ClipboardList, BarChart3, Clock, History, Users, Settings } from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

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
    <StudentDashboardModulePage scrollMode="panel">
      <FacultyModuleSplitLayout
        scrollMode="panel"
        className="min-h-0 flex-1"
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
    </StudentDashboardModulePage>
  )
}
