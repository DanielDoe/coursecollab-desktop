"use client"

import { Sparkles } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { FacultyAiAssistantSettingsHub } from "@/components/instructor/administration/FacultyAiAssistantSettingsHub"

export default function AiAssistantSettingsPage() {
  return (
    <InstructorAdministrationModulePage
      title="Cora Assistant Settings"
      description=""
      icon={Sparkles}
      moduleId="ai-assistant-settings"
      showHeader={false}
    >
      <FacultyAiAssistantSettingsHub />
    </InstructorAdministrationModulePage>
  )
}
