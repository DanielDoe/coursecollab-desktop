"use client"

import { Suspense } from "react"
import { FacultySettingsHub } from "@/components/instructor/FacultySettingsHub"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"

export default function SettingsPage() {
  return (
    <Suspense fallback={<InstructorPolicyLoadingState moduleId="settings" label="Loading settings…" />}>
      <FacultySettingsHub />
    </Suspense>
  )
}
