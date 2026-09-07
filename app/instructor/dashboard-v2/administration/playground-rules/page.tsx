"use client"

import { Gamepad2 } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorPlaygroundRulesHub } from "@/components/instructor/InstructorPlaygroundRulesHub"

export default function PlaygroundRulesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Playground Rules"
      description=""
      icon={Gamepad2}
      moduleId="playground-rules"
      showHeader={false}
    >
      <InstructorPlaygroundRulesHub />
    </InstructorAdministrationModulePage>
  )
}
