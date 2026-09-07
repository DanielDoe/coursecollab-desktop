"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { AppearanceSetupForm } from "@/components/auth/AppearanceSetupForm"
import { getInstructorData, getStudentData } from "@/lib/auth"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import {
  type AppearanceAudience,
  appearanceDestinationFor,
  appearanceRoleFor,
  hasCompletedAppearanceSetup,
  syncAppearanceSetupFromServer,
} from "@/lib/appearance/appearance-setup"

type Subject = {
  audience: AppearanceAudience
  userId: string
  name?: string
}

/**
 * Work out who is being prompted from whatever session exists, rather than
 * from a query param. Four audiences share this one page and each returns to a
 * different place; taking that destination from the URL would make this an
 * open redirect on a post-auth route.
 *
 * Student is checked first because it is the more specific case — campers and
 * career members are student sessions with a flag, and a shared browser can
 * hold a student and an instructor session at once.
 */
function resolveSubject(): Subject | null {
  const student = getStudentData()
  if (student?.databaseId) {
    const audience: AppearanceAudience = student.isPlatformGuest
      ? "guest"
      : student.isSummerCamper || isSummerProgramRole(student.studentProgramRole ?? "")
        ? "summer_camper"
        : "student"
    return { audience, userId: String(student.databaseId), name: student.name }
  }

  const instructor = getInstructorData()
  if (instructor?.id) {
    return { audience: "instructor", userId: String(instructor.id), name: instructor.name }
  }

  return null
}

export default function AuthThemeSetupPage() {
  const router = useRouter()
  const [subject, setSubject] = useState<Subject | null>(null)

  useEffect(() => {
    const found = resolveSubject()
    if (!found) {
      router.replace("/auth/student")
      return
    }
    void (async () => {
      const role = appearanceRoleFor(found.audience)
      const completed =
        hasCompletedAppearanceSetup(found.userId, role) ||
        (await syncAppearanceSetupFromServer(found.userId, role))
      if (completed) {
        router.replace(appearanceDestinationFor(found.audience))
        return
      }
      setSubject(found)
    })()
  }, [router])

  if (!subject) return null

  return (
    <AuthShell showBack={false} contentMaxWidth="max-w-3xl">
      <AuthGlassCard className="max-w-3xl w-full">
        <AppearanceSetupForm
          audience={subject.audience}
          userId={subject.userId}
          displayName={subject.name}
        />
      </AuthGlassCard>
    </AuthShell>
  )
}
