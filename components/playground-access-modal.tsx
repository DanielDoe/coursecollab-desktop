"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Crown, Clock, ArrowRight, Sparkles, Gamepad2, Brain } from "lucide-react"
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

  const handleUpgrade = () => {
    onClose()
    router.push("/student/dashboard-v2/membership")
  }
  
  // Refresh membership data when modal closes (in case the student upgraded in another tab)
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
        <div className="border-b border-[var(--border)] bg-[var(--cc-accent-soft)] px-8 py-6 pr-14">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--cc-accent)] p-3 text-white">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="mb-1 text-2xl font-semibold text-[var(--cc-text)] sm:text-3xl">
                {getTitle()}
              </DialogTitle>
              <DialogDescription className="text-base text-[var(--cc-text-secondary)]">
                {getDescription()}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Current Status Card */}
          {errorType === "insufficient_credits" || errorType === "wait_for_reset" ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="relative p-6">
                <div className="mb-4 flex items-center gap-4">
                  <div className="rounded-xl bg-[var(--cc-accent-soft)] p-3">
                    <Clock className="h-6 w-6 text-[var(--cc-accent-dark)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-xl font-semibold text-[var(--cc-text)]">Credits Reset Timer</h3>
                    <p className="text-sm text-[var(--cc-text-muted)]">
                      {daysUntilReset > 0
                        ? `Your credits will reset in ${daysUntilReset} day${daysUntilReset !== 1 ? "s" : ""}`
                        : "Your credits will reset soon"}
                    </p>
                  </div>
                  <Badge className="border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--cc-accent-dark)]">
                    {currentCredits}/{typeof creditsLimit === "number" ? creditsLimit : 0} Credits
                  </Badge>
                </div>
                <div className="rounded-lg bg-[var(--muted)] p-4">
                  <p className="text-sm text-[var(--cc-text-secondary)]">
                    <strong>Current Tier:</strong> {tier} • <strong>Weekly Limit:</strong>{" "}
                    {formatPlaygroundCredits(creditsLimit)}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}

          {(errorType === "upgrade_required" || errorType === "no_access") && (
          <>
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
                <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-[var(--cc-accent-soft)] p-2">
                        <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--cc-text)]">{explorerPlan.displayName}</h3>
                    </div>
                    <Badge className="border border-[var(--border)] bg-[var(--muted)] px-3 py-1 text-base text-[var(--cc-text)]">{explorerPlan.badge}</Badge>
                  </div>

                  <div className="mb-6 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-[var(--cc-text)]">
                      ${(explorerPlan.priceInCents / 100).toFixed(2)}
                    </span>
                    <span className="text-[var(--cc-text-muted)]">/month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 rounded-lg bg-[var(--muted)] p-3">
                      <Gamepad2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cc-accent)]" />
                      <div>
                        <div className="text-sm font-semibold text-[var(--cc-text)]">Playground: {formatPlaygroundCredits(explorerPlan.features.playgroundCredits)}</div>
                        <div className="text-xs text-[var(--cc-text-muted)]">Credits reset weekly</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg bg-[var(--muted)] p-3">
                      <Brain className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cc-accent)]" />
                      <div>
                        <div className="text-sm font-semibold text-[var(--cc-text)]">
                          AI Tutor:{" "}
                          {typeof explorerPlan.features.aiTutor === "number"
                            ? `${explorerPlan.features.aiTutor.toLocaleString()} Cora Credits/month`
                            : "Included"}
                        </div>
                        <div className="text-xs text-[var(--cc-text-muted)]">Credits reset weekly</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpgrade}
                    size="lg"
                    className="w-full"
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
                <div className="relative rounded-2xl border-2 border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/40 p-6">
                  <Badge className="absolute -top-3 right-4 bg-[var(--cc-accent)] px-4 py-1 text-sm font-semibold text-white">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    Best Value
                  </Badge>

                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-[var(--cc-accent)] p-2 text-white">
                        <Crown className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--cc-text)]">{trailblazerPlan.displayName}</h3>
                    </div>
                    <Badge className="bg-[var(--cc-accent)] px-3 py-1 text-base text-white">
                      {trailblazerPlan.badge}
                    </Badge>
                  </div>

                  <div className="mb-6 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-[var(--cc-accent-dark)]">
                      ${(trailblazerPlan.priceInCents / 100).toFixed(2)}
                    </span>
                    <span className="text-[var(--cc-text-muted)]">/month</span>
                  </div>

                  <div className="mb-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <Gamepad2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cc-accent)]" />
                      <div>
                        <div className="text-sm font-semibold text-[var(--cc-text)]">Unlimited Playground</div>
                        <div className="text-xs text-[var(--cc-text-muted)]">No credit limits</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <Brain className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cc-accent)]" />
                      <div>
                        <div className="text-sm font-semibold text-[var(--cc-text)]">High-capacity Cora</div>
                        <div className="text-xs text-[var(--cc-text-muted)]">No credit limits</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpgrade}
                    size="lg"
                    className="w-full"
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

