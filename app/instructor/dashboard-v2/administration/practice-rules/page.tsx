"use client"

import { Brain } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorPracticeHubRulesHub } from "@/components/instructor/InstructorPracticeHubRulesHub"

export default function PracticeRulesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Practice Hub Rules"
      description=""
      icon={Brain}
      moduleId="practice-rules"
      showHeader={false}
    >
      <InstructorPracticeHubRulesHub />
    </InstructorAdministrationModulePage>
  )
}
