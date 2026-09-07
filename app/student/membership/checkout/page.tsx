"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  CreditCard,
  Mail,
  Sparkles,
  ChevronRight,
} from "lucide-react"
import { MEMBERSHIP_PLANS, studentSemesterOffer, type MembershipTier, type BillingCadence } from "@/lib/membership-constants"
import { calculateSemesterSavings } from "@/lib/semester-utils-client"
import {
  isSemesterOnlyBillingStudent,
  resolveStudentBillingCadence,
} from "@/lib/student-billing-eligibility"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js"
import { useToast } from "@/hooks/use-toast"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"
import { StudentSemesterDiscountPrice } from "@/components/student/membership/StudentSemesterDiscountPrice"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const BRAND = "#582c83"

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [needsEmail, setNeedsEmail] = useState(false)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [savingEmail, setSavingEmail] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [billingChecked, setBillingChecked] = useState(false)

  const planId = searchParams.get("plan") as MembershipTier
  const cadenceParam = searchParams.get("cadence") as BillingCadence | null
  const requestedCadence: BillingCadence = cadenceParam === "semester" ? "semester" : "monthly"
  const [billingCadence, setBillingCadence] = useState<BillingCadence>(requestedCadence)

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    if (!id) {
      router.push("/student/login")
      return
    }
    setStudentId(id)

    let cancelled = false
    async function resolveBillingCadence() {
      let semesterOnly = isSemesterOnlyBillingStudent(getStudentData()?.isPlatformGuest)

      try {
        const response = await studentApiFetch(`/api/student/membership?studentId=${id}`)
        if (response.ok) {
          const data = await response.json()
          semesterOnly = Boolean(data.billing?.semesterOnly)
        }
      } catch {
        // Fall back to session guest flag when membership billing lookup fails.
      }

      const allowedCadence = resolveStudentBillingCadence(
        planId || "Explorer",
        requestedCadence,
        semesterOnly,
      )
      if (!cancelled) {
        setBillingCadence(allowedCadence)
        if (allowedCadence !== requestedCadence && planId) {
          router.replace(`/student/membership/checkout?plan=${planId}&cadence=${allowedCadence}`)
        }
        setBillingChecked(true)
      }
    }

    void resolveBillingCadence()
    return () => {
      cancelled = true
    }
  }, [router, requestedCadence, planId])

  const selectedPlan = MEMBERSHIP_PLANS.find((p) => p.id === planId)
  const displayPrice =
    billingCadence === "semester" && selectedPlan?.semesterPriceInCents
      ? selectedPlan.semesterPriceInCents / 100
      : (selectedPlan?.priceInCents || 0) / 100
  const priceLabel = billingCadence === "semester" ? "/semester" : "/month"
  const savings =
    selectedPlan && billingCadence === "semester"
      ? calculateSemesterSavings(selectedPlan)
      : null

  if (!billingChecked) {
    return (
      <MembershipLayout backHref="/student/membership" backLabel="Back to Plans">
        <div className="max-w-lg mx-auto py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MembershipLayout>
    )
  }

  if (!selectedPlan || selectedPlan.id === "Scholar") {
    return (
      <MembershipLayout backHref="/student/membership" backLabel="Back to Plans">
        <div className="max-w-lg mx-auto py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center"
          >
            <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Plan Not Available
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The selected plan is not available for checkout.
            </p>
            <Button
              onClick={() => router.push("/student/membership")}
              className="rounded-xl"
              style={{ backgroundColor: BRAND }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              View Plans
            </Button>
          </motion.div>
        </div>
      </MembershipLayout>
    )
  }

  const handleSaveEmailAndCheckout = async () => {
    setEmailError("")
    if (!email.trim()) {
      setEmailError("Email is required")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address")
      return
    }
    setSavingEmail(true)
    try {
      const response = await studentApiFetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, email: email.trim() }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save email")
      }
      await proceedToStripeCheckout()
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Failed to save email")
      setSavingEmail(false)
    }
  }

  const proceedToStripeCheckout = async (redirectToStripe = false) => {
    if (!studentId) return

    if (!redirectToStripe) {
      const stored = sessionStorage.getItem("checkoutClientSecret")
      if (stored) {
        setClientSecret(stored)
        sessionStorage.removeItem("checkoutClientSecret")
        sessionStorage.removeItem("checkoutSessionId")
        return
      }
    }

    const studentIdValue = sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")
    const section = sessionStorage.getItem("studentSection") || localStorage.getItem("studentSection")
    const membershipTier = sessionStorage.getItem("studentMembershipTier") || localStorage.getItem("studentMembershipTier")
    if (studentIdValue) {
      localStorage.setItem("studentDatabaseId", studentIdValue)
      if (section) {
        localStorage.setItem("studentSection", section)
        sessionStorage.setItem("studentSection", section)
      }
      if (membershipTier) {
        localStorage.setItem("studentMembershipTier", membershipTier)
        sessionStorage.setItem("studentMembershipTier", membershipTier)
      }
      if (!sessionStorage.getItem("studentDatabaseId")) {
        sessionStorage.setItem("studentDatabaseId", studentIdValue)
      }
    }

    setLoading(true)
    try {
      const response = await studentApiFetch("/api/student/membership/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          tier: planId,
          billingCadence,
          redirectCheckout: redirectToStripe,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (data.needsEmail) {
          setNeedsEmail(true)
          setLoading(false)
          setSavingEmail(false)
          return
        }
        if (data.code === "MONTHLY_NOT_AVAILABLE") {
          toast({
            title: "Semester plan required",
            description: data.error || "Course students can only purchase the semester plan.",
            variant: "destructive",
          })
          router.replace(`/student/membership/checkout?plan=${planId}&cadence=semester`)
          setLoading(false)
          setSavingEmail(false)
          return
        }
        if (data.code === "ALREADY_SUBSCRIBED" && data.redirectToManage) {
          toast({
            title: "Already Subscribed",
            description: data.message || "You already have an active membership. Redirecting to manage...",
          })
          router.push("/student/membership/manage")
          setLoading(false)
          setSavingEmail(false)
          return
        }
        throw new Error(data.error || "Failed to create checkout session")
      }

      if (data.requiresPayment && data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      if (data.requiresPayment && data.clientSecret) {
        setClientSecret(data.clientSecret)
      } else {
        router.push("/student/membership/success")
      }
      setLoading(false)
      setSavingEmail(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout.",
        variant: "destructive",
      })
      setLoading(false)
      setSavingEmail(false)
    }
  }

  const handleCheckout = async (redirectToStripe = false) => {
    await proceedToStripeCheckout(redirectToStripe)
  }

  // Payment form view (Stripe embedded)
  if (clientSecret) {
    return (
      <MembershipLayout showBack={false}>
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setClientSecret(null)}
            className="mb-6 rounded-xl"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Review
          </Button>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden"
          >
            <div
              className="px-6 py-4 border-b border-slate-200/80 dark:border-white/10"
              style={{ backgroundColor: `${BRAND}08` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: `${BRAND}15` }}
                >
                  <CreditCard className="h-5 w-5" style={{ color: BRAND }} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Complete Payment
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Secure checkout powered by Stripe
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
              <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/10">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Form not loading? Try the external checkout.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={() => handleCheckout(true)}
                >
                  Pay on Stripe&apos;s secure page
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </MembershipLayout>
    )
  }

  // Order review view
  return (
    <MembershipLayout backHref="/student/membership" backLabel="Back to Plans">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <div
            className="flex size-8 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: BRAND }}
          >
            1
          </div>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <div className="flex size-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-sm font-medium">
            2
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">
            Review → Payment
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden"
        >
          <div
            className="p-6 sm:p-8"
            style={{
              background: `linear-gradient(135deg, ${BRAND} 0%, #6d3a9e 50%, #7a4eba 100%)`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {selectedPlan.displayName}
                </h1>
                <p className="text-sm text-white/80 mt-1">{selectedPlan.description}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium shrink-0">
                {selectedPlan.badge}
              </span>
            </div>
            <div className="mt-6">
              {billingCadence === "semester" && selectedPlan.id !== "Scholar" ? (
                <StudentSemesterDiscountPrice tier={selectedPlan.id} inverted />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    ${displayPrice.toFixed(2)}
                  </span>
                  <span className="text-white/80">{priceLabel}</span>
                </div>
              )}
              {billingCadence === "semester" && studentSemesterOffer(selectedPlan.id) ? (
                <p className="mt-1 text-sm text-white/80">One-time this semester · then you&apos;re covered through finals</p>
              ) : null}
            </div>
            {savings && savings.savings > 0 && billingCadence === "semester" && !studentSemesterOffer(selectedPlan.id) ? (
              <div className="mt-2">
                <span className="inline-flex items-center rounded-lg bg-emerald-500/30 px-2.5 py-1 text-sm font-medium text-emerald-100">
                  Save ${savings.savings.toFixed(2)} vs monthly
                </span>
              </div>
            ) : null}
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: BRAND }} />
                Included
              </h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {selectedPlan.features.quizAttempts} quiz attempts per quiz
                </li>
                {selectedPlan.features.lectures && (
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Lectures & videos
                  </li>
                )}
                {selectedPlan.features.leaderboard && (
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Playground leaderboard
                  </li>
                )}
                {selectedPlan.features.aiTutor !== "No access" && (
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Cora ({selectedPlan.features.aiTutor})
                  </li>
                )}
                {selectedPlan.features.codeBench && (
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    CodeBench IDE
                  </li>
                )}
                {selectedPlan.features.earlyAccess && (
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Early access to beta features
                  </li>
                )}
              </ul>
            </div>

            <AnimatePresence>
              {needsEmail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <Mail className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      Add your email to receive receipts and membership updates.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setEmailError("")
                      }}
                      disabled={savingEmail}
                      className="rounded-xl"
                    />
                    {emailError && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {emailError}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveEmailAndCheckout}
                    disabled={savingEmail}
                    className="w-full rounded-xl"
                    style={{ backgroundColor: BRAND }}
                  >
                    {savingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Save & Continue
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!needsEmail && (
              <div className="space-y-4">
                <MembershipDisclaimer />
                <Button
                  onClick={() => handleCheckout()}
                  disabled={loading}
                  className="w-full rounded-xl h-12 text-base font-semibold"
                  style={{ backgroundColor: BRAND }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      Proceed to Payment
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Shield className="h-3.5 w-3.5" />
                  Secure payment by Stripe • Cancel anytime
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-slate-500"
                  onClick={() => handleCheckout(true)}
                  disabled={loading}
                >
                  Pay on Stripe&apos;s page instead
                </Button>
              </div>
            )}
          </CardContent>
        </motion.div>
      </div>
    </MembershipLayout>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
