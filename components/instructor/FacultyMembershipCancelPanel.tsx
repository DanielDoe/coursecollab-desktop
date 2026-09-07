"use client"

import { Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function CancelContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan") as InstructorMembershipTier | null
  const cadence = searchParams.get("cadence") || "semester"

  const selectedPlan = useMemo(
    () => INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === planId) ?? null,
    [planId],
  )

  const retryHref = planId
    ? `${FACULTY_MEMBERSHIP_HREF}/checkout?plan=${planId}&cadence=${cadence}`
    : FACULTY_MEMBERSHIP_HREF

  return (
    <div className="mx-auto w-full max-w-lg py-4">
      <InstructorPolicySurfaceCard className="text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/40">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className={cn("text-2xl font-bold mb-2", PORTAL_TEXT)}>Payment not completed</h1>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          {selectedPlan
            ? `Your ${selectedPlan.displayName} upgrade was not completed. No charges were made.`
            : "Checkout was cancelled. No charges were made."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            className={cn("h-12 flex-1 rounded-xl font-semibold", PORTAL_CTA)}
            onClick={() => router.push(retryHref)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className={cn("h-12 flex-1 rounded-xl", PORTAL_OUTLINE_BTN)}>
            <Link href={FACULTY_MEMBERSHIP_HREF}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to plans
            </Link>
          </Button>
        </div>
      </InstructorPolicySurfaceCard>
    </div>
  )
}

export function FacultyMembershipCancelPanel() {
  return (
    <Suspense fallback={<div className={cn("py-20 text-center text-sm", PORTAL_TEXT_MUTED)}>Loading…</div>}>
      <CancelContent />
    </Suspense>
  )
}
