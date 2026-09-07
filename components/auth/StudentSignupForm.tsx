"use client"

import type { UniversityRecord } from "@/lib/universities-shared"
import { StudentSignupExperience } from "@/components/student/onboarding/StudentSignupExperience"

type Props = {
  university: UniversityRecord
}

/** @deprecated Use StudentSignupExperience directly — kept for imports. */
export function StudentSignupForm({ university }: Props) {
  return <StudentSignupExperience university={university} />
}
