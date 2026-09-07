"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Crown, Check, Sparkles, Gamepad2, Brain, ArrowRight, Code2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { motion } from "framer-motion"

interface RolloverUpgradeModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Shown when a Scholar (or non-rollover) student tries to use "Extend" on a missed assessment.
 * Balanced size: readable and spacious, fits in view without scroll. Amber/slate theme.
 */
export function RolloverUpgradeModal({ open, onClose }: RolloverUpgradeModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [returnPath, setReturnPath] = useState<string | null>(null)

  useEffect(() => {
    if (open && pathname) {
      setReturnPath(pathname)
      sessionStorage.setItem("retakeModalReturnPath", pathname)
    }
  }, [open, pathname])

  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  const handleUpgrade = () => {
    onClose()
    router.push("/student/dashboard-v2/membership")
  }

  const handleClose = () => {
    onClose()
    if (returnPath && returnPath !== "/student/membership/plans" && returnPath !== "/student/dashboard-v2/membership" && returnPath !== "/student/upgrade") {
      router.push(returnPath)
    }
  }

  const features = [
    { icon: Clock, label: "Explorer: 1 rollover per assessment (24h). Trailblazer: 3 rollovers (24h each)" },
    { icon: Sparkles, label: "Extension for missed homework, quizzes & finals" },
    { icon: Check, label: "2 Retakes (3 attempts)" },
    { icon: Brain, label: "High-capacity Cora" },
    { icon: Code2, label: "CodeBench IDE" },
    { icon: Gamepad2, label: "Unlimited Playground" },
  ]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        {/* Header — larger, clear hierarchy */}
        <div className="relative bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700 px-6 py-5 text-white rounded-t-lg shrink-0">
          <div className="absolute inset-0 opacity-20 dark:opacity-25 rounded-t-lg" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`
          }} />
          <div className="relative z-10 flex items-start gap-4">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
              className="p-3 bg-white/20 dark:bg-white/25 backdrop-blur-sm rounded-xl shrink-0"
            >
              <Clock className="h-6 w-6 text-white" />
            </motion.div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle className="text-xl sm:text-2xl font-bold leading-tight text-white">
                Missed a deadline? Extend with Explorer or Trailblazer
              </DialogTitle>
              <DialogDescription className="text-amber-100 dark:text-amber-200/90 text-sm mt-1.5">
                Explorer includes one 24-hour extension per missed assessment. Trailblazer includes up to three 24-hour windows per assessment when you need more time.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-6">
          {trailblazerPlan ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 shadow-lg overflow-hidden"
            >
              {/* Plan title row */}
              <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-700/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500 dark:bg-amber-600 shrink-0 shadow-md">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-lg">{trailblazerPlan.displayName}</span>
                </div>
                <Badge className="bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500 text-white text-sm px-3 py-1 shrink-0 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
                  Includes extensions
                </Badge>
              </div>

              <div className="p-5 space-y-5">
                {/* Pricing — symmetrical two columns */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 shadow-sm text-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      ${((trailblazerPlan.monthlyPriceInCents || trailblazerPlan.priceInCents) / 100).toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
                  </div>
                  {trailblazerPlan.semesterPriceInCents != null ? (
                    <div className="relative flex flex-col gap-1.5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/60 text-center">
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-semibold shrink-0">
                        Best value
                      </Badge>
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        ${(trailblazerPlan.semesterPriceInCents / 100).toFixed(2)}
                      </span>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">/semester</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-center opacity-75">
                      <span className="text-lg font-bold text-slate-500 dark:text-slate-400">—</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">/semester</span>
                    </div>
                  )}
                </div>

                {/* Features — 2 rows, readable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {features.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600"
                    >
                      <f.icon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleUpgrade}
                  size="lg"
                  className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-lg hover:shadow-xl py-6 text-base font-semibold rounded-xl"
                >
                  <Crown className="h-5 w-5 mr-2" />
                  Upgrade to Trailblazer
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-600 dark:text-slate-400 gap-4">
              <p className="text-base">Trailblazer plan not found.</p>
              <Button onClick={handleUpgrade} variant="outline" size="lg" className="border-slate-300 dark:border-slate-600 dark:hover:bg-slate-800">
                View membership plans
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
