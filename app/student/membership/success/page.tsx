"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { CheckCircle, Sparkles, Loader2, Crown, ArrowRight, Gift } from "lucide-react"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { useToast } from "@/hooks/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { notifyNativeNavigate, notifyNativeRefreshStudentData } from "@/lib/native-student-refresh-bridge"
import { useNativeApp } from "@/hooks/use-native-app"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import confetti from "canvas-confetti"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const homeLink = useSmartHomeLink()
  const isNative = useNativeApp()
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(true)
  const [planName, setPlanName] = useState("")
  const [planId, setPlanId] = useState("")
  const [membershipVerified, setMembershipVerified] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")

    if (!studentId) {
      const session = searchParams.get("session_id")
      const plan = searchParams.get("plan")
      if (session) {
        sessionStorage.setItem("membershipSuccessSession", session)
        router.push(
          `/student/login?redirect=${encodeURIComponent(
            plan ? `/student/membership/success?session_id=${session}&plan=${plan}` : `/student/membership/success?session_id=${session}`
          )}`
        )
        return
      }
    }

    const verifyMembership = async () => {
      try {
        const id = sessionStorage.getItem("studentDatabaseId")
        if (!id) {
          setLoading(false)
          setVerifying(false)
          return
        }

        const planFromUrl = searchParams.get("plan")
        const plan = planFromUrl || sessionStorage.getItem("studentMembershipTier") || ""
        setPlanId(plan)

        const selectedPlan = MEMBERSHIP_PLANS.find((p) => p.id === plan)
        if (selectedPlan) setPlanName(selectedPlan.displayName)

        const fetchCurrentMembership = async () => {
          try {
            const res = await studentApiFetch(`/api/student/membership?studentId=${id}`)
            if (res.ok) {
              const data = await res.json()
              const tier = data.membership?.tier || data.membership?.plan
              if (tier) {
                setPlanId(tier)
                const p = MEMBERSHIP_PLANS.find((x) => x.id === tier)
                if (p) setPlanName(p.displayName)
                sessionStorage.setItem("studentMembershipTier", tier)
                localStorage.setItem("studentMembershipTier", tier)
                return tier
              }
            }
          } catch (e) {
            console.error(e)
          }
          return null
        }

        const syncFromStripe = async () => {
          try {
            const res = await fetch(`/api/membership/sync-stripe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ studentId: parseInt(id) }),
            })
            if (res.ok) {
              const data = await res.json()
              if (data.success && data.tier) {
                sessionStorage.setItem("studentMembershipTier", data.tier)
                localStorage.setItem("studentMembershipTier", data.tier)
                setPlanId(data.tier)
                const p = MEMBERSHIP_PLANS.find((x) => x.id === data.tier)
                if (p) setPlanName(p.displayName)
                setMembershipVerified(true)
                setVerifying(false)
                notifyNativeRefreshStudentData()
              }
            }
          } catch (e) {
            console.error(e)
          }
        }

        const refreshMembership = async () => {
          try {
            const res = await studentApiFetch(`/api/student/membership/refresh?studentId=${id}`)
            if (res.ok) {
              const data = await res.json()
              if (data.tier) {
                sessionStorage.setItem("studentMembershipTier", data.tier)
                localStorage.setItem("studentMembershipTier", data.tier)
                setPlanId(data.tier)
                const p = MEMBERSHIP_PLANS.find((x) => x.id === data.tier)
                if (p) setPlanName(p.displayName)
                setMembershipVerified(true)
                setVerifying(false)
                notifyNativeRefreshStudentData()
              }
            }
          } catch (e) {
            console.error(e)
          }
        }

        const actualTier = await fetchCurrentMembership()
        if (actualTier && actualTier !== plan) {
          const p = MEMBERSHIP_PLANS.find((x) => x.id === actualTier)
          if (p) setPlanName(p.displayName)
        }

        syncFromStripe()
        refreshMembership()

        let attempts = 0
        const checkMembership = async () => {
          try {
            const res = await studentApiFetch(`/api/student/membership?studentId=${id}`)
            if (res.ok) {
              const data = await res.json()
              const tier = data.membership?.tier || data.membership?.plan
              if (tier) {
                setPlanId(tier)
                const p = MEMBERSHIP_PLANS.find((x) => x.id === tier)
                if (p) setPlanName(p.displayName)
                setMembershipVerified(true)
                setVerifying(false)
                // Refresh sessionStorage
                sessionStorage.setItem("studentMembershipTier", tier)
                localStorage.setItem("studentMembershipTier", tier)
                notifyNativeRefreshStudentData()
                return true
              }
            }
          } catch (e) {
            console.error(e)
          }
          attempts++
          if (attempts < 10) setTimeout(checkMembership, 1000)
          else {
            setVerifying(false)
            toast({
              title: "Payment Processed",
              description: "Your membership is being activated. Refresh in a moment if needed.",
            })
          }
          return false
        }

        setTimeout(checkMembership, 2000)
        setLoading(false)
      } catch (e) {
        console.error(e)
        setLoading(false)
        setVerifying(false)
      }
    }

    verifyMembership()
  }, [searchParams, toast, router])

  useEffect(() => {
    if (loading || verifying || !planId || isNative) return

    const duration = 3000
    const end = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

    const timeoutId = setTimeout(() => {
      const interval = setInterval(() => {
        const timeLeft = end - Date.now()
        if (timeLeft <= 0) {
          clearInterval(interval)
          return
        }
        const count = 50 * (timeLeft / duration)
        confetti({ ...defaults, particleCount: count, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
        confetti({ ...defaults, particleCount: count, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
      }, 250)
      return () => clearInterval(interval)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [loading, verifying, planId, isNative])

  const getPlanPerks = () => {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === planId)
    if (!plan) return []

    const perks: string[] = []
    if (plan.features.quizAttempts > 0) {
      perks.push(`${plan.features.quizAttempts} quiz attempts per quiz`)
    }
    if (typeof plan.features.aiTutor === "number" && plan.features.aiTutor > 0) {
      perks.push(`Cora (${plan.features.aiTutor.toLocaleString()} credits/month)`)
    }
    if (plan.features.codeBench) perks.push("CodeBench IDE")
    if (plan.features.leaderboard) perks.push("Playground leaderboard")
    if (plan.features.lectures) perks.push("All lectures")
    if (plan.features.earlyAccess) {
      perks.push("Early access to new features")
      perks.push("Advanced analytics")
    }
    if (plan.features.saveAndFinishLater) {
      perks.push("Save and Finish Later")
    }
    if (plan.id === "Trailblazer") {
      perks.push("Achievement Badges & Progress Milestones")
      perks.push("Attempt history & solution review")
    }
    return perks
  }

  const handleBackToDashboard = () => {
    setIsNavigating(true)
    notifyNativeRefreshStudentData()
    if (isNative) {
      notifyNativeNavigate("/dashboard")
      return
    }
    window.location.href = homeLink || "/student/dashboard"
  }

  if (loading || verifying) {
    return (
      <MembershipLayout showBack={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[var(--cc-accent)]" />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            {verifying ? "Verifying your membership..." : "Loading..."}
          </p>
        </div>
      </MembershipLayout>
    )
  }

  const perks = getPlanPerks()

  return (
    <MembershipLayout showBack={false}>
      <div className="max-w-xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
        >
          <div className="p-8 sm:p-10 bg-gradient-to-br from-[var(--cc-accent)] via-[var(--cc-accent-hover)] to-[var(--cc-accent-dark)]">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="mx-auto mb-4 flex size-16 sm:size-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-4 ring-white/30"
            >
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Welcome to {planName || planId || "your new plan"}!
            </h1>
            <p className="text-white/90 text-sm sm:text-base">
              {membershipVerified
                ? "Your premium features are now active."
                : "Payment received. Your membership is being activated."}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className={cn("flex items-center justify-center gap-2", PORTAL_TEXT_MUTED)}>
              <Sparkles className="h-4 w-4 text-[var(--cc-accent)]" />
              <span className={cn("font-medium", PORTAL_TEXT)}>
                Premium features active
              </span>
              <Sparkles className="h-4 w-4 text-[var(--cc-accent)]" />
            </div>

            {perks.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <Crown className="h-5 w-5 text-[var(--cc-accent)]" />
                  <h3 className={cn("font-semibold", PORTAL_TEXT)}>Your perks</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {perks.map((perk, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}
                    >
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      {perk}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleBackToDashboard}
                disabled={isNavigating}
                className={cn("flex-1 rounded-xl h-12 font-semibold", PORTAL_CTA)}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {isNavigating ? "Loading..." : "Go to Dashboard"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (isNative) {
                    notifyNativeNavigate("/membership")
                    return
                  }
                  router.push("/student/membership")
                }}
                className="flex-1 rounded-xl h-12"
              >
                <Crown className="mr-2 h-4 w-4" />
                View Membership
              </Button>
            </div>

            <p className={cn("text-xs flex items-center justify-center gap-2", PORTAL_TEXT_MUTED)}>
              <Gift className="h-3.5 w-3.5" />
              Confirmation email sent
            </p>
          </div>
        </motion.div>
      </div>
    </MembershipLayout>
  )
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <MembershipLayout showBack={false}>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-[var(--cc-accent)]" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading...</p>
          </div>
        </MembershipLayout>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
