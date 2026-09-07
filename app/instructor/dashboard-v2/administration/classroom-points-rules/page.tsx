"use client"

import { Sparkles } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorClassroomPointsRulesHub } from "@/components/instructor/InstructorClassroomPointsRulesHub"

export default function ClassroomPointsRulesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Classroom Points Rules"
      description=""
      icon={Sparkles}
      moduleId="classroom-points-rules"
      showHeader={false}
    >
      <InstructorClassroomPointsRulesHub />
    </InstructorAdministrationModulePage>
  )
}
