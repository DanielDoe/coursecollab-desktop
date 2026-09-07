"use client"

import { Scale } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorGradingPoliciesHub } from "@/components/instructor/InstructorGradingPoliciesHub"

export default function GradingPoliciesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Grading Policies"
      description=""
      icon={Scale}
      moduleId="grading-policies"
      showHeader={false}
    >
      <InstructorGradingPoliciesHub />
    </InstructorAdministrationModulePage>
  )
}
