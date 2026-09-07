"use client"

import { Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { notifyNativeNavigate } from "@/lib/native-student-refresh-bridge"
import { useNativeApp } from "@/hooks/use-native-app"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function CancelContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNative = useNativeApp()

  const planId = (searchParams.get("plan") as MembershipTier | null) ?? null
  const selectedPlan = useMemo(
    () => MEMBERSHIP_PLANS.find((plan) => plan.id === planId) ?? null,
    [planId],
  )

  const retryHref = planId
    ? `/student/membership/checkout?plan=${planId}&cadence=semester`
    : "/student/membership"

  function goToPlans() {
    if (isNative) {
      notifyNativeNavigate("/membership")
      return
    }
    router.push("/student/membership")
  }

  function retryCheckout() {
    if (isNative) {
      notifyNativeNavigate(planId ? `/membership/checkout?plan=${planId}` : "/membership")
      return
    }
    router.push(retryHref)
  }

  return (
    <MembershipLayout showBack={false}>
      <div className="max-w-lg mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
        >
          <div className="p-8 sm:p-10 text-center space-y-5">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden />
            </div>
            <div className="space-y-2">
              <h1 className={cn("text-2xl font-bold", PORTAL_TEXT)}>Payment not completed</h1>
              <p className={cn("text-sm sm:text-base leading-relaxed", PORTAL_TEXT_MUTED)}>
                {selectedPlan
                  ? `Your ${selectedPlan.displayName} upgrade was not completed. No charges were made.`
                  : "Checkout was cancelled before payment completed. No charges were made."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={retryCheckout}
                className={cn("flex-1 rounded-xl h-12 font-semibold", PORTAL_CTA)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try checkout again
              </Button>
              <Button variant="outline" onClick={goToPlans} className={cn("flex-1 rounded-xl h-12", PORTAL_OUTLINE_BTN)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to plans
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </MembershipLayout>
  )
}

export default function MembershipCancelPage() {
  return (
    <Suspense
      fallback={
        <MembershipLayout showBack={false}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          </div>
        </MembershipLayout>
      }
    >
      <CancelContent />
    </Suspense>
  )
}
