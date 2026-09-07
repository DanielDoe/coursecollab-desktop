"use client"

import { InstructorLoginForm } from "@/components/instructor-login-form"

/** Faculty portal uses the same violet instructor login card (instructors, TAs, graders, observers). */
export function FacultyLoginForm({
  className,
  nativeApp = false,
}: {
  className?: string
  nativeApp?: boolean
}) {
  return (
    <InstructorLoginForm
      idPrefix="faculty-"
      className={className}
      nativeApp={nativeApp}
      title="Faculty sign in"
      subtitle="Instructors, TAs, graders, and observers use the same portal"
    />
  )
}
