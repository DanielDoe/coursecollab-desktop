"use client"

import { useRouter } from "next/navigation"
import { BookmarkCheck, ArrowRight, Clock, Code2, RotateCcw, Crown, Infinity } from "lucide-react"
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

interface SaveAndFinishLaterUpgradeModalProps {
  open: boolean
  onClose: () => void
}

export function SaveAndFinishLaterUpgradeModal({
  open,
  onClose,
}: SaveAndFinishLaterUpgradeModalProps) {
  const router = useRouter()
  const explorerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")
  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  const handleUpgrade = () => {
    onClose()
    router.push("/student/dashboard-v2/membership")
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg w-full p-0">
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 p-4 sm:p-6 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
              <BookmarkCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold mb-1">
                Save and Finish Later
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-xs sm:text-sm">
                Requires Explorer or Trailblazer membership
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Feature List */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              What you&apos;ll get:
            </h3>
            <div className="grid gap-2.5">
              <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Pause anytime</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Save your progress and resume when you&apos;re ready. No time pressure.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Code2 className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Answers & code preserved</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Your answers and code are saved exactly as you left them.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Resume where you left off</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Pick up with the same question and time remaining.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Explorer Plan - 3 saved assessments */}
          {explorerPlan && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-teal-900/30"
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <BookmarkCheck className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white">Explorer</h4>
                    <div className="flex flex-wrap items-baseline gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                        3 saved assessments
                      </Badge>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        ${((explorerPlan.monthlyPriceInCents || explorerPlan.priceInCents) / 100).toFixed(2)}/month
                      </span>
                      {explorerPlan.semesterPriceInCents && (
                        <>
                          <span className="text-xs text-slate-400">or</span>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                            ${(explorerPlan.semesterPriceInCents / 100).toFixed(2)}/semester
                          </span>
                          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                            Save ${(((explorerPlan.monthlyPriceInCents || explorerPlan.priceInCents) * 5 - explorerPlan.semesterPriceInCents) / 100).toFixed(2)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleUpgrade}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                  size="sm"
                >
                  Upgrade to Explorer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Trailblazer Plan - Unlimited */}
          {trailblazerPlan && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="relative overflow-hidden rounded-xl border-2 border-purple-400 dark:border-purple-600 bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-pink-900/30"
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white">Trailblazer</h4>
                    <div className="flex flex-wrap items-baseline gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                        <Infinity className="h-3 w-3 mr-0.5" />
                        Unlimited
                      </Badge>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        ${((trailblazerPlan.monthlyPriceInCents || trailblazerPlan.priceInCents) / 100).toFixed(2)}/month
                      </span>
                      {trailblazerPlan.semesterPriceInCents && (
                        <>
                          <span className="text-xs text-slate-400">or</span>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                            ${(trailblazerPlan.semesterPriceInCents / 100).toFixed(2)}/semester
                          </span>
                          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                            Save ${(((trailblazerPlan.monthlyPriceInCents || trailblazerPlan.priceInCents) * 5 - trailblazerPlan.semesterPriceInCents) / 100).toFixed(2)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleUpgrade}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  size="sm"
                >
                  Upgrade to Trailblazer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Close Button */}
          <div className="flex justify-center pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="text-slate-600 dark:text-slate-400"
            >
              Continue Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
