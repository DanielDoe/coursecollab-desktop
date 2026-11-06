"use client"

import { FolderCog } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorProjectSettingsHub } from "@/components/instructor/InstructorProjectSettingsHub"

export default function ProjectSettingsPage() {
  return (
    <InstructorAdministrationModulePage
      title="Project Settings"
      description=""
      icon={FolderCog}
      moduleId="project-settings"
      showHeader={false}
    >
      <InstructorProjectSettingsHub />
    </InstructorAdministrationModulePage>
  )
}
