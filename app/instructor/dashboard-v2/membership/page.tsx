"use client"

import { Suspense } from "react"
import { FacultyMembershipPlansHub } from "@/components/instructor/FacultyMembershipPlansHub"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"

export default function FacultyMembershipPage() {
  return (
    <Suspense fallback={<InstructorPolicyLoadingState moduleId="membership" label="Loading plans…" />}>
      <FacultyMembershipPlansHub />
    </Suspense>
  )
}
