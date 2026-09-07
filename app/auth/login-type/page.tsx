"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { hasRememberedFacultyUniversity, hasRememberedStudentUniversity } from "@/lib/remembered-auth"

/** Legacy route — student flow skips this step; faculty uses ?role=faculty or landing Faculty login. */
export default function AuthLoginTypePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedUniversityId } = useAuth()
  const roleHint = searchParams.get("role")

  useEffect(() => {
    if (roleHint === "faculty") {
      if (!selectedUniversityId && !hasRememberedFacultyUniversity()) {
        router.replace("/auth/university?next=faculty")
        return
      }
      router.replace("/faculty/login")
      return
    }

    if (!selectedUniversityId && !hasRememberedStudentUniversity()) {
      router.replace("/auth/university")
      return
    }
    router.replace("/auth/student")
  }, [selectedUniversityId, roleHint, router])

  return null
}
