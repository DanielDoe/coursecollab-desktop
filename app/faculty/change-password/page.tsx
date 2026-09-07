"use client"

import { useEffect, useState } from "react"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { FacultyChangePasswordForm } from "@/components/faculty-change-password-form"
import type { UniversityRecord } from "@/lib/universities-shared"
import { SELECTED_UNIVERSITY_DATA_KEY } from "@/lib/universities-shared"
import { readRememberedFacultyUniversity } from "@/lib/remembered-auth"

export default function FacultyChangePasswordPage() {
  const [university, setUniversity] = useState<UniversityRecord | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SELECTED_UNIVERSITY_DATA_KEY)
      if (raw) {
        setUniversity(JSON.parse(raw) as UniversityRecord)
        return
      }
    } catch {
      /* ignore */
    }
    setUniversity(readRememberedFacultyUniversity())
  }, [])

  return (
    <AuthShell backHref="/faculty/login" university={university}>
      <AuthGlassCard>
        <FacultyChangePasswordForm />
      </AuthGlassCard>
    </AuthShell>
  )
}
