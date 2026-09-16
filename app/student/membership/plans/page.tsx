"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Sparkles } from "lucide-react"
import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"
import { cn } from "@/lib/utils"

const BRAND = "#582c83"

export default function MembershipPlansPage() {
  const router = useRouter()
  const [currentTier, setCurrentTier] = useState<MembershipTier>("Scholar")
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    const tier = sessionStorage.getItem("studentMembershipTier") as MembershipTier

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentId(id)
    setCurrentTier(tier || "Scholar")
    setLoading(false)
  }, [router])

  const handleSelectPlan = (planId: MembershipTier) => {
    if (planId === "Scholar") {
      router.push("/student/membership/manage")
    } else if (planId === currentTier) {
      router.push("/student/membership")
    } else {
      router.push(`/student/membership/checkout?plan=${planId}`)
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
          <p className="text-slate-600 dark:text-slate-400">Loading plans...</p>
        </div>
      </MembershipLayout>
    )
  }

  return (
    <MembershipLayout backHref="/student/membership" backLabel="Back to Membership">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Choose Your Plan
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Select the plan that fits your learning goals
          </p>
        </motion.div>

        <MembershipDisclaimer className="mb-6" />

        <div className="grid gap-6 md:grid-cols-3">
          {MEMBERSHIP_PLANS.map((plan, i) => {
            const isCurrent = plan.id === currentTier
            const isPremium = plan.id === "Trailblazer"

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={cn(
                    "relative h-full flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl",
                    isPremium && "ring-2 ring-[#582c83]/50 shadow-lg",
                    isCurrent && "ring-2 ring-emerald-500/50"
                  )}
                >
                  {isPremium && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge
                        className="px-3 py-1 rounded-full text-white text-xs font-semibold"
                        style={{ backgroundColor: BRAND }}
                      >
                        <Sparkles className="h-3 w-3 mr-1 inline" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 right-4 z-10">
                      <Badge variant="secondary" className="rounded-full">
                        Current
                      </Badge>
                    </div>
                  )}

                  <CardHeader
                    className={cn(
                      "text-center pb-4 pt-6",
                      isPremium && "text-white",
                      plan.id === "Explorer" && "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
                      plan.id === "Scholar" && "bg-gradient-to-r from-slate-500 to-slate-600 text-white"
                    )}
                    style={
                      isPremium
                        ? { background: `linear-gradient(135deg, ${BRAND} 0%, #6d3a9e 100%)` }
                        : undefined
                    }
                  >
                    <div className="text-4xl mb-4">{plan.badge}</div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription
                      className={cn(
                        "text-sm mt-1",
                        (isPremium || plan.id === "Explorer" || plan.id === "Scholar")
                          ? "text-white/80"
                          : "text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {plan.description}
                    </CardDescription>
                    <div className="mt-4">
                      {plan.priceInCents === 0 ? (
                        <div className="text-2xl font-bold">Free</div>
                      ) : (
                        <div className="text-2xl font-bold">
                          ${(plan.priceInCents / 100).toFixed(2)}
                          <span className="text-sm font-normal opacity-80">/month</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-6 space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        {plan.features.quizAttempts > 0 ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">
                          {plan.features.quizAttempts} quiz attempt
                          {plan.features.quizAttempts !== 1 ? "s" : ""} per quiz
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.lectures ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">Lectures & videos</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.leaderboard ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">Playground leaderboard</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.aiTutor !== 0 && plan.features.aiTutor !== "No access" ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">
                          Cora{" "}
                          {typeof plan.features.aiTutor === "number" && plan.features.aiTutor > 0
                            ? `(${plan.features.aiTutor.toLocaleString()}/month)`
                            : "(No access)"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.codeBench ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">CodeBench IDE</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.codeBenchCora ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">Cora in CodeBench</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.earlyAccess ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">Early access to beta features</span>
                      </div>
                      <div className="flex items-start gap-2">
                        {plan.features.saveAndFinishLater ? (
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">
                          Save and Finish Later
                          {plan.features.saveAndFinishLater === "unlimited" && " (Unlimited)"}
                          {typeof plan.features.saveAndFinishLater === "number" && ` (${plan.features.saveAndFinishLater})`}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-6 pt-0">
                    <Button
                      className={cn(
                        "w-full rounded-xl h-11 font-semibold",
                        isPremium && "text-white"
                      )}
                      variant={isPremium ? "default" : isCurrent ? "outline" : "secondary"}
                      style={isPremium ? { backgroundColor: BRAND } : undefined}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCurrent && plan.id !== "Scholar"}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : plan.id === "Scholar"
                          ? "Downgrade to Free"
                          : currentTier === "Scholar"
                            ? "Upgrade Now"
                            : "Switch Plan"}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 p-6"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">FAQ</h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                Can I change my plan later?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Yes! Upgrade, downgrade, or cancel anytime from Manage Subscription.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                What happens if I downgrade?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Premium features stay active until the end of your billing period.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                Is there a refund policy?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                7-day money-back guarantee. Contact support for a full refund.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </MembershipLayout>
  )
}
