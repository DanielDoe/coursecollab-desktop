"use client"

import { Users } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorTeamProjectPoliciesHub } from "@/components/instructor/InstructorTeamProjectPoliciesHub"

export default function TeamProjectPoliciesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Team & Project Policies"
      description=""
      icon={Users}
      moduleId="team-project-policies"
      showHeader={false}
    >
      <InstructorTeamProjectPoliciesHub />
    </InstructorAdministrationModulePage>
  )
}
