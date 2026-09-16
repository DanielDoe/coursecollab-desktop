"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { readFacultySession } from "@/lib/faculty-auth-flow"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [planName, setPlanName] = useState("")
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const session = readFacultySession()
    const instructorId =
      session?.id != null
        ? String(session.id)
        : localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
    const sessionId = searchParams.get("session_id")
    const planFromUrl = searchParams.get("plan") as InstructorMembershipTier | null

    if (planFromUrl) {
      const plan = INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === planFromUrl)
      if (plan) setPlanName(plan.displayName)
    }

    async function verify() {
      if (!instructorId) {
        setVerifying(false)
        return
      }
      try {
        const res = await instructorApiFetch("/api/instructor/membership/sync-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instructorId: parseInt(instructorId, 10),
            sessionId,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.tier) {
            localStorage.setItem("instructorMembershipTier", data.tier)
            sessionStorage.setItem("instructorMembershipTier", data.tier)
            const plan = INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === data.tier)
            if (plan) setPlanName(plan.displayName)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setVerifying(false)
      }
    }

    void verify()
  }, [searchParams])

  return (
    <div className="mx-auto w-full max-w-lg py-4">
      <InstructorPolicySurfaceCard className="text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)]">
          {verifying ? (
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          ) : (
            <CheckCircle className="h-8 w-8 text-[var(--cc-accent)]" />
          )}
        </div>
        <h1 className={cn("text-2xl font-bold mb-2", PORTAL_TEXT)}>
          {verifying ? "Activating your license…" : "You're all set!"}
        </h1>
        <p className={cn("text-sm sm:text-base", PORTAL_TEXT_MUTED)}>
          {planName
            ? `Your ${planName} license is active. Cora Teaching Copilot and authoring tools are ready.`
            : "Your instructor license has been activated."}
        </p>
        {!verifying && (
          <Button
            className={cn("mt-6 h-12 w-full rounded-xl font-semibold", PORTAL_CTA)}
            onClick={() => router.push(FACULTY_DASHBOARD_BASE)}
          >
            Go to dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </InstructorPolicySurfaceCard>
    </div>
  )
}

export function FacultyMembershipSuccessPanel() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
