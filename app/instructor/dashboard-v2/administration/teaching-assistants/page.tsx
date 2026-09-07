"use client"

import { UserCog } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorTeachingAssistantsHub } from "@/components/instructor/InstructorTeachingAssistantsHub"

export default function InstructorTeachingAssistantsPage() {
  return (
    <InstructorAdministrationModulePage
      title="Teaching assistants"
      description=""
      icon={UserCog}
      moduleId="teaching-assistants"
      showHeader={false}
    >
      <InstructorTeachingAssistantsHub />
    </InstructorAdministrationModulePage>
  )
}
