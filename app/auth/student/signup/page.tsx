"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { StudentSignupExperience } from "@/components/student/onboarding/StudentSignupExperience"
import { useAuth } from "@/lib/auth-context"
import { readRememberedUniversity } from "@/lib/remembered-auth"
import { readSessionSelectedUniversity } from "@/lib/universities-shared"

export default function StudentSignupPage() {
  const router = useRouter()
  const { university, selectedUniversityId, setSelectedUniversity } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (selectedUniversityId && university) {
      setReady(true)
      return
    }
    const sessionUniversity = readSessionSelectedUniversity()
    if (sessionUniversity) {
      setSelectedUniversity(sessionUniversity)
      setReady(true)
      return
    }
    const remembered = readRememberedUniversity()
    if (remembered) {
      setSelectedUniversity(remembered)
      setReady(true)
      return
    }
    router.replace("/auth/university?next=signup")
  }, [selectedUniversityId, university, router, setSelectedUniversity])

  if (!ready || !university) return null

  return <StudentSignupExperience university={university} />
}
