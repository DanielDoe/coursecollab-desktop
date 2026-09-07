"use client"

import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { FacultySignupForm } from "@/components/faculty-signup-form"
import { useDesktopSignupRedirect } from "@/components/auth/useDesktopSignupRedirect"
import { DESKTOP_WEB_SIGNUP_PATHS } from "@/lib/desktop-auth-policy"
import type { UniversityRecord } from "@/lib/universities-shared"
import { SELECTED_UNIVERSITY_DATA_KEY } from "@/lib/universities-shared"
import { readRememberedFacultyUniversity } from "@/lib/remembered-auth"
import { useEffect, useState } from "react"

export default function FacultySignupPage() {
  const [university, setUniversity] = useState<UniversityRecord | null>(null)

  useDesktopSignupRedirect(DESKTOP_WEB_SIGNUP_PATHS.faculty, "/faculty/login")

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
    <AuthShell backHref="/faculty/login" university={university} contentMaxWidth="max-w-xl">
      <AuthGlassCard>
        <FacultySignupForm />
      </AuthGlassCard>
    </AuthShell>
  )
}
