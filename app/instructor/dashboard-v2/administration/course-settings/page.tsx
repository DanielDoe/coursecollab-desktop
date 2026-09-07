"use client"

import { Sliders } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorCourseSettingsPanel } from "@/components/instructor/InstructorCourseSettingsPanel"

export default function CourseSettingsPage() {
  return (
    <InstructorAdministrationModulePage
      title="Course Settings"
      description=""
      icon={Sliders}
      moduleId="course-settings"
      showHeader={false}
    >
      <InstructorCourseSettingsPanel />
    </InstructorAdministrationModulePage>
  )
}
