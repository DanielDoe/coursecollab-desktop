"use client"

import { ClipboardList } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorAssessmentDefaultsHub } from "@/components/instructor/InstructorAssessmentDefaultsHub"

export default function AssessmentDefaultsPage() {
  return (
    <InstructorAdministrationModulePage
      title="Assessment Defaults"
      description=""
      icon={ClipboardList}
      moduleId="assessment-defaults"
      showHeader={false}
    >
      <InstructorAssessmentDefaultsHub />
    </InstructorAdministrationModulePage>
  )
}
