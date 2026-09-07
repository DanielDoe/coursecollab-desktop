"use client"

import { useState } from "react"
import { BarChart3, ClipboardList, Clock } from "lucide-react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import {
  InstructorCourseEvaluations,
  type CourseEvaluationNavSection,
} from "@/components/instructor/course-evaluations-hub"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

const SECTIONS: {
  id: CourseEvaluationNavSection
  label: string
  icon: typeof BarChart3
}[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "evaluations", label: "Evaluations", icon: ClipboardList },
  { id: "pending-approval", label: "Pending Approval", icon: Clock },
]

export default function InstructorCourseEvaluationsPage() {
  const [activeSection, setActiveSection] = useState<CourseEvaluationNavSection>("overview")

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <FacultyModuleSplitLayout
            menu={
              <FacultyModuleSideMenu
                moduleId="course-evaluations"
                title="Course Evaluations"
                accent="theme"
                activeId={activeSection}
                onSelect={(id) => setActiveSection(id as CourseEvaluationNavSection)}
                items={SECTIONS}
              />
            }
          >
            <InstructorCourseEvaluations activeSection={activeSection} />
          </FacultyModuleSplitLayout>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
