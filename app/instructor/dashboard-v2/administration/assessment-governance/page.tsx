"use client"

import { Shield } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorAssessmentGovernancePanel } from "@/components/instructor/InstructorAssessmentGovernancePanel"

export default function AssessmentGovernancePage() {
  return (
    <InstructorAdministrationModulePage
      title="Assessment Governance"
      description=""
      icon={Shield}
      moduleId="assessment-governance"
      showHeader={false}
    >
      <InstructorAssessmentGovernancePanel />
    </InstructorAdministrationModulePage>
  )
}
