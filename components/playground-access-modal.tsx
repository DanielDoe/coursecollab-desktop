"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Crown, Gift, Heart, Clock, ArrowRight, X, Sparkles, Gamepad2, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MEMBERSHIP_PLANS, PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants"
import { motion } from "framer-motion"

interface PlaygroundAccessModalProps {
  open: boolean
  onClose: () => void
  errorType?: "insufficient_credits" | "no_access" | "upgrade_required" | "wait_for_reset"
  errorMessage?: string
  currentCredits?: number
  creditsLimit?: number | "unlimited"
  tier?: string
  daysUntilReset?: number
}

export function PlaygroundAccessModal({
  open,
  onClose,
  errorType,
  errorMessage,
  currentCredits = 0,
  creditsLimit = 0,
  tier = "Scholar",
  daysUntilReset = 0,
}: PlaygroundAccessModalProps) {
  const router = useRouter()
  const explorerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")
  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  const handleDonate = () => {
    onClose()
    // Store return path so donation success page can redirect back
    const currentPath = window.location.pathname
    sessionStorage.setItem("retakeModalReturnPath", currentPath)
    router.push("/student/donate")
  }

  const handleUpgrade = () => {
    onClose()
    router.push("/student/dashboard-v2/membership")
  }
  
  // Refresh membership data when modal closes (in case user upgraded/donated in another tab)
  useEffect(() => {
    if (!open) {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      if (studentId) {
        // Refresh membership data in background
        studentApiFetch(`/api/student/membership/refresh?studentId=${studentId}`)
          .then(res => res.json())
          .then(data => {
            if (data.tier) {
              sessionStorage.setItem("studentMembershipTier", data.tier)
              localStorage.setItem("studentMembershipTier", data.tier)
            }
          })
          .catch(() => {
            // Failed to refresh membership
          })
      }
    }
  }, [open])

  const formatPlaygroundCredits = (credits: number | "unlimited"): string => {
    if (credits === "unlimited") return "Unlimited"
    if (typeof credits === "number") return `${credits} credit${credits !== 1 ? "s" : ""}/week`
    return "No access"
  }

  const getTitle = () => {
    switch (errorType) {
      case "insufficient_credits":
        return "Playground Credits Exhausted"
      case "no_access":
        return "Playground Access Restricted"
      case "upgrade_required":
        return "Upgrade Required"
      case "wait_for_reset":
        return "Credits Reset Soon"
      default:
        return "Access Restricted"
    }
  }

  const getDescription = () => {
    switch (errorType) {
      case "insufficient_credits":
        return `You have used all ${typeof creditsLimit === "number" ? creditsLimit : PLAYGROUND_WEEKLY_CREDITS} of your weekly playground credits. They reset automatically each week.`
      case "no_access":
        return "Playground access is not available right now."
      case "upgrade_required":
        return "Upgrade your membership to access the Playground feature."
      case "wait_for_reset":
        return `Your credits will reset in ${daysUntilReset} day${daysUntilReset !== 1 ? "s" : ""}.`
      default:
        return errorMessage || "Unable to join playground right now."
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl lg:max-w-[50rem] w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 p-8 text-white rounded-t-lg overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"
              >
                <Lock className="h-6 w-6" />
              </motion.div>
              <div>
                <DialogTitle className="text-3xl font-extrabold mb-1">
                  {getTitle()}
                </DialogTitle>
                <DialogDescription className="text-purple-100 text-base">
                  {getDescription()}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Current Status Card */}
          {errorType === "insufficient_credits" || errorType === "wait_for_reset" ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-blue-900/30"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Credits Reset Timer</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {daysUntilReset > 0
                        ? `Your credits will reset in ${daysUntilReset} day${daysUntilReset !== 1 ? "s" : ""}`
                        : "Your credits will reset soon"}
                    </p>
                  </div>
                  <Badge className="bg-blue-600 text-white px-3 py-1 text-sm font-semibold">
                    {currentCredits}/{typeof creditsLimit === "number" ? creditsLimit : 0} Credits
                  </Badge>
                </div>
                <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <strong>Current Tier:</strong> {tier} • <strong>Weekly Limit:</strong>{" "}
                    {formatPlaygroundCredits(creditsLimit)}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}

          {(errorType === "upgrade_required" || errorType === "no_access") && (
          <>
          {/* Donation Option */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border-2 border-rose-300 dark:border-rose-700 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/30 dark:via-pink-900/30 dark:to-rose-900/30 shadow-lg"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-400/20 to-transparent rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl shadow-lg">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Support CourseCollab</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Unlock 14 days of premium access</p>
                </div>
                <Badge className="bg-rose-600 text-white px-3 py-1 text-sm font-semibold">14 Days</Badge>
              </div>

              <p className="text-slate-700 dark:text-slate-300 mb-5 leading-relaxed">
                Donate any amount to unlock <strong>14 days of Trailblazer-level access</strong>, including unlimited playground and AI tutor!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <Gamepad2 className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Unlimited Playground</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <Brain className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">High-capacity Cora</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDonate}
                size="lg"
                className="w-full bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 hover:from-rose-700 hover:via-pink-700 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Gift className="h-5 w-5 mr-2" />
                Donate Now - Unlock Premium
              </Button>
            </div>
          </motion.div>

          {/* Membership Plans */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Explorer */}
            {explorerPlan && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{explorerPlan.displayName}</h3>
                    </div>
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1">{explorerPlan.badge}</Badge>
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      ${(explorerPlan.priceInCents / 100).toFixed(2)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">/month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Gamepad2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Playground: {formatPlaygroundCredits(explorerPlan.features.playgroundCredits)}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Credits reset weekly</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Brain className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">
                          AI Tutor:{" "}
                          {typeof explorerPlan.features.aiTutor === "number"
                            ? `${explorerPlan.features.aiTutor.toLocaleString()} Cora Credits/month`
                            : "Included"}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Credits reset weekly</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpgrade}
                    size="lg"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    Upgrade to Explorer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Trailblazer */}
            {trailblazerPlan && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300" />
                <div className="relative p-6 rounded-2xl border-2 border-purple-400 dark:border-purple-600 bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-pink-900/30 shadow-2xl">
                  <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 text-sm font-bold shadow-lg">
                    <Sparkles className="h-3 w-3 mr-1 inline" />
                    Best Value
                  </Badge>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg shadow-lg">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{trailblazerPlan.displayName}</h3>
                    </div>
                    <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-lg px-3 py-1">
                      {trailblazerPlan.badge}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                      ${(trailblazerPlan.priceInCents / 100).toFixed(2)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">/month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Gamepad2 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Unlimited Playground</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Brain className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">High-capacity Cora</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpgrade}
                    size="lg"
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Crown className="h-5 w-5 mr-2" />
                    Upgrade to Trailblazer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
          </>
          )}

          {(errorType === "insufficient_credits" || errorType === "wait_for_reset") && (
            <div className="flex justify-end pt-2">
              <Button onClick={onClose} size="lg" className="w-full sm:w-auto">
                Got it
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

