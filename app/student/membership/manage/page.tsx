"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, CreditCard, Calendar, AlertTriangle } from "lucide-react"
import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import { useToast } from "@/hooks/use-toast"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"

const BRAND = "#582c83"

interface SubscriptionData {
  plan: MembershipTier
  status: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd: boolean
  isFreeTier: boolean
}

export default function ManageMembershipPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentTier, setCurrentTier] = useState<MembershipTier>("Scholar")
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)
  const [redirectingToPortal, setRedirectingToPortal] = useState(false)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    plan: "Scholar",
    status: "active",
    cancelAtPeriodEnd: false,
    isFreeTier: true,
  })

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    const tier = sessionStorage.getItem("studentMembershipTier") as MembershipTier

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentId(id)
    setCurrentTier(tier || "Scholar")

    fetchSubscriptionData(id)
  }, [router])

  const fetchSubscriptionData = async (id: string) => {
    try {
      const response = await fetch("/api/membership/get-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id }),
      })

      if (!response.ok) throw new Error("Failed to fetch subscription data")

      const data = await response.json()
      setSubscriptionData(data)
      setCurrentTier(data.plan)
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to load subscription data. Please refresh.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!studentId) {
      toast({
        title: "Error",
        description: "Student ID not found. Please refresh.",
        variant: "destructive",
      })
      return
    }

    setCanceling(true)
    try {
      const response = await fetch("/api/membership/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to cancel subscription")
      }

      setSubscriptionData((prev) => ({ ...prev, cancelAtPeriodEnd: true }))
      await fetchSubscriptionData(studentId)

      const refreshResponse = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentId}`)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (refreshData.tier) {
          sessionStorage.setItem("studentMembershipTier", refreshData.tier)
          localStorage.setItem("studentMembershipTier", refreshData.tier)
          setCurrentTier(refreshData.tier)
        }
      }

      toast({
        title: "Subscription Canceled",
        description:
          data.message ||
          "Your subscription will end at the end of the current billing period.",
      })
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCanceling(false)
    }
  }

  const handleReactivateSubscription = async () => {
    try {
      const response = await fetch("/api/membership/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to reactivate")
      }

      setSubscriptionData((prev) => ({ ...prev, cancelAtPeriodEnd: false }))
      await fetchSubscriptionData(studentId!)

      const refreshResponse = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentId}`)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (refreshData.tier) {
          sessionStorage.setItem("studentMembershipTier", refreshData.tier)
          localStorage.setItem("studentMembershipTier", refreshData.tier)
          setCurrentTier(refreshData.tier)
        }
      }

      toast({
        title: "Subscription Reactivated",
        description: "Your subscription will continue automatically.",
      })
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate.",
        variant: "destructive",
      })
    }
  }

  const handleManageSubscription = async () => {
    setRedirectingToPortal(true)
    try {
      const response = await fetch("/api/membership/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })

      if (!response.ok) throw new Error("Failed to create portal session")

      const { url } = await response.json()
      window.location.href = url
    } catch {
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive",
      })
      setRedirectingToPortal(false)
    }
  }

  if (loading) {
    return (
      <MembershipLayout backHref="/student/membership" backLabel="Back to Membership">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div
            className="w-12 h-12 rounded-full animate-spin border-2 border-transparent"
            style={{ borderTopColor: BRAND }}
          />
          <p className="text-slate-600 dark:text-slate-400">Loading subscription...</p>
        </div>
      </MembershipLayout>
    )
  }

  if (subscriptionData.isFreeTier) {
    return (
      <MembershipLayout backHref="/student/membership" backLabel="Back to Membership">
        <div className="max-w-lg mx-auto space-y-4">
          <MembershipDisclaimer />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 p-8 text-center"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              No Active Subscription
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You&apos;re on the free Scholar plan. Upgrade to unlock premium features.
            </p>
            <Button
              onClick={() => router.push("/student/membership/plans")}
              className="rounded-xl"
              style={{ backgroundColor: BRAND }}
            >
              View Premium Plans
            </Button>
          </motion.div>
        </div>
      </MembershipLayout>
    )
  }

  const currentPlan = MEMBERSHIP_PLANS.find((p) => p.id === currentTier)
  const periodEndDate = subscriptionData.currentPeriodEnd
    ? new Date(subscriptionData.currentPeriodEnd)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return (
    <MembershipLayout backHref="/student/membership" backLabel="Back to Membership">
      <div className="max-w-2xl mx-auto space-y-6">
        <MembershipDisclaimer />
        {subscriptionData.cancelAtPeriodEnd && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-6"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Subscription Ending
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  Your subscription will end on{" "}
                  <strong>
                    {periodEndDate.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                  . You&apos;ll lose access to premium features after that.
                </p>
                <Button
                  onClick={handleReactivateSubscription}
                  className="mt-4 rounded-xl"
                  style={{ backgroundColor: BRAND }}
                >
                  Reactivate Subscription
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden"
        >
          <div
            className="p-6"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #6d3a9e 100%)` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{currentPlan?.badge}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{currentPlan?.displayName}</h2>
                  <p className="text-sm text-white/80">{currentPlan?.description}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  subscriptionData.status === "active"
                    ? "bg-emerald-500/30 text-emerald-100"
                    : "bg-slate-500/30 text-slate-200"
                }`}
              >
                {subscriptionData.status === "active" ? "Active" : subscriptionData.status}
              </span>
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Price</span>
              <span className="font-medium">${(currentPlan?.priceInCents || 0) / 100}/month</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Next billing</span>
              <span className="font-medium">
                {periodEndDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
            <Button
              variant="outline"
              onClick={() => router.push("/student/membership/plans")}
              className="w-full rounded-xl"
            >
              Change Plan
            </Button>
          </CardFooter>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5" style={{ color: BRAND }} />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Payment & Billing
            </h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Manage payment methods, view invoices, and update billing in the Stripe portal.
          </p>
          <Button
            onClick={handleManageSubscription}
            disabled={redirectingToPortal}
            className="w-full rounded-xl"
            style={{ backgroundColor: BRAND }}
          >
            {redirectingToPortal ? "Opening..." : "Open Billing Portal"}
          </Button>
        </motion.div>

        {!subscriptionData.cancelAtPeriodEnd && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="rounded-2xl border-red-200/80 dark:border-red-900/50">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">
                  Cancel Subscription
                </CardTitle>
                <CardDescription>
                  Cancel and return to the free Scholar plan at the end of your billing period.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={canceling} className="rounded-xl">
                      {canceling ? "Canceling..." : "Cancel Subscription"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your subscription stays active until{" "}
                        {periodEndDate.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        . After that, you&apos;ll lose: extra quiz attempts, Cora, CodeBench,
                        leaderboard, and more.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-red-600 hover:bg-red-700 rounded-xl"
                      >
                        Yes, Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </div>
    </MembershipLayout>
  )
}
