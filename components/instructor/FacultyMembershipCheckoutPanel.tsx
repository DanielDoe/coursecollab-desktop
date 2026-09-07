"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import { readFacultySession } from "@/lib/faculty-auth-flow"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  type InstructorBillingCadence,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan") as InstructorMembershipTier | null
  const cadence = (searchParams.get("cadence") === "annual" ? "annual" : "semester") as InstructorBillingCadence
  const [loading, setLoading] = useState(false)
  const [instructorId, setInstructorId] = useState<string | null>(null)

  const selectedPlan = INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === planId)
  const priceCents =
    cadence === "annual"
      ? selectedPlan?.annualPriceInCents ?? 0
      : selectedPlan?.semesterPriceInCents ?? 0

  useEffect(() => {
    const session = readFacultySession()
    const id =
      session?.id != null
        ? String(session.id)
        : localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
    if (!id) {
      router.push("/faculty/login")
      return
    }
    setInstructorId(id)
  }, [router])

  async function startCheckout() {
    if (!instructorId || !planId || planId === "Free") return
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/membership/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: parseInt(instructorId, 10),
          tier: planId,
          billingCadence: cadence,
          redirectCheckout: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || "Checkout failed")
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      throw new Error("No checkout URL returned")
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Checkout failed")
      setLoading(false)
    }
  }

  if (!selectedPlan || selectedPlan.id === "Free") {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <p className={cn("mb-4", PORTAL_TEXT_MUTED)}>Invalid plan selected.</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href={FACULTY_MEMBERSHIP_HREF}>Back to plans</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <Button asChild variant="ghost" className="rounded-xl -ml-2">
        <Link href={FACULTY_MEMBERSHIP_HREF}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to plans
        </Link>
      </Button>

      <InstructorPolicySurfaceCard title={selectedPlan.displayName} description={selectedPlan.tagline}>
        <div className="space-y-4">
          <div className="rounded-xl bg-[var(--sidebar-accent)]/15 px-4 py-4">
            <div className={cn("text-3xl font-bold tabular-nums", PORTAL_TEXT)}>
              ${(priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)}
              <span className={cn("text-base font-normal", PORTAL_TEXT_MUTED)}>
                {cadence === "annual" ? " / year" : " / semester"}
              </span>
            </div>
            <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>One-time payment · no auto-renew</p>
          </div>

          <div className={cn("flex items-start gap-2 text-sm", PORTAL_TEXT_MUTED)}>
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
            <span>Secure checkout via Stripe. Your license activates immediately after payment.</span>
          </div>

          <Button
            className={cn("h-12 w-full rounded-xl text-base font-semibold", PORTAL_CTA)}
            disabled={loading || !instructorId}
            onClick={() => void startCheckout()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to Stripe…
              </>
            ) : (
              "Continue to payment"
            )}
          </Button>
        </div>
      </InstructorPolicySurfaceCard>
    </div>
  )
}

export function FacultyMembershipCheckoutPanel() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-text-muted)]" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
