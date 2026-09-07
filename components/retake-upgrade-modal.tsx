"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { X, Heart, Crown, Gift, Check, Sparkles, Zap, Rocket, Star, Coins, Gamepad2, Brain, Lock, ArrowRight, Code2, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { motion } from "framer-motion"

interface RetakeUpgradeModalProps {
  open: boolean
  onClose: () => void
  assessmentType?: string
}

export function RetakeUpgradeModal({ open, onClose, assessmentType = "assessment" }: RetakeUpgradeModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [returnPath, setReturnPath] = useState<string | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    setStudentId(id || null)
  }, [])

  // Store the current path when modal opens
  useEffect(() => {
    if (open && pathname) {
      setReturnPath(pathname)
      // Store in sessionStorage so donation/upgrade pages can redirect back
      sessionStorage.setItem("retakeModalReturnPath", pathname)
    }
  }, [open, pathname])

  const explorerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")
  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  const handleDonate = () => {
    onClose()
    router.push("/student/donate")
  }

  const handleUpgrade = () => {
    onClose()
    router.push("/student/dashboard-v2/membership")
  }

  const handleViewUpgradePage = () => {
    onClose()
    router.push("/student/upgrade")
  }

  const handleClose = () => {
    onClose()
    // Redirect back to the assessment page if we have a return path
    if (returnPath && returnPath !== "/student/donate" && returnPath !== "/student/membership/plans" && returnPath !== "/student/dashboard-v2/membership" && returnPath !== "/student/upgrade") {
      router.push(returnPath)
    }
  }

  const formatAITutorAccess = (access: number | "unlimited"): string => {
    if (access === "unlimited") return "Unlimited"
    if (typeof access === "number" && access > 0) return `${access.toLocaleString()} Cora Credits/month`
    return "Cora Credits included"
    return "No access"
  }

  const formatPlaygroundCredits = (credits: number | "unlimited"): string => {
    if (credits === "unlimited") return "Unlimited"
    if (typeof credits === "number") return `${credits} credit${credits !== 1 ? 's' : ''}/week`
    return "No access"
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                  Unlock Premium Features
                </DialogTitle>
                <DialogDescription className="text-purple-100 text-base">
                  Upgrade your membership to access {assessmentType} retakes and unlock powerful learning tools
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Donation Option - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border-2 border-rose-300 dark:border-rose-700 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/30 dark:via-pink-900/30 dark:to-rose-900/30 shadow-lg"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-400/20 to-pink-400/20 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl shadow-lg">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Support CourseCollab</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Unlock 14 days of premium access</p>
                </div>
                <Badge className="bg-gradient-to-r from-rose-600 to-pink-600 text-white px-3 py-1 text-sm font-semibold">
                  14 Days
                </Badge>
              </div>
              
              <p className="text-slate-700 dark:text-slate-300 mb-5 leading-relaxed">
                Donate any amount to unlock <strong>14 days of Trailblazer-level access</strong>, including unlimited retakes, AI Tutor, and Playground!
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <Check className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">2 Retakes</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">3 total attempts</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <Brain className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">High-capacity Cora</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Tutor access</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <Gamepad2 className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Unlimited</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Playground</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                  <BookmarkCheck className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Save and Finish Later</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Resume quizzes anytime</div>
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

          {/* Membership Plans - Enhanced */}
          <div className="space-y-6">
            {/* Explorer Plan */}
            {explorerPlan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                <div className="relative p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <Star className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{explorerPlan.displayName}</h3>
                    </div>
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1">{explorerPlan.badge}</Badge>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {/* Monthly Option */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                          ${((explorerPlan.monthlyPriceInCents || explorerPlan.priceInCents) / 100).toFixed(2)}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">/month</span>
                      </div>
                    </div>
                    
                    {/* Semester Option */}
                    {explorerPlan.semesterPriceInCents && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 relative">
                        <Badge className="absolute -top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5">
                          Best Value
                        </Badge>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                            ${(explorerPlan.semesterPriceInCents / 100).toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">/semester</span>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                          One-time payment • Save ${(((explorerPlan.monthlyPriceInCents || explorerPlan.priceInCents) * 5 - explorerPlan.semesterPriceInCents) / 100).toFixed(2)} vs monthly
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Check className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">1 Retake per assessment</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">2 total attempts</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Check className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Leaderboard access</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Compete with peers</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Brain className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">AI Tutor: {formatAITutorAccess(explorerPlan.features.aiTutor)}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Credits reset weekly</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Gamepad2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Playground: {formatPlaygroundCredits(explorerPlan.features.playgroundCredits)}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Credits reset weekly</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <BookmarkCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Save and Finish Later</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Resume quizzes anytime</div>
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

            {/* Trailblazer Plan */}
            {trailblazerPlan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
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
                    <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-lg px-3 py-1">{trailblazerPlan.badge}</Badge>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {/* Monthly Option */}
                    <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                          ${((trailblazerPlan.monthlyPriceInCents || trailblazerPlan.priceInCents) / 100).toFixed(2)}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">/month</span>
                      </div>
                    </div>
                    
                    {/* Semester Option */}
                    {trailblazerPlan.semesterPriceInCents && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 relative">
                        <Badge className="absolute -top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5">
                          Best Value
                        </Badge>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                            ${(trailblazerPlan.semesterPriceInCents / 100).toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">/semester</span>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                          One-time payment • Save ${(((trailblazerPlan.monthlyPriceInCents || trailblazerPlan.priceInCents) * 5 - trailblazerPlan.semesterPriceInCents) / 100).toFixed(2)} vs monthly
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Check className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">2 Retakes per assessment</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">3 total attempts</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Brain className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">High-capacity Cora</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Code2 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">CodeBench IDE access</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Full development environment</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Gamepad2 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Unlimited Playground</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">No credit limits</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Rocket className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Early access to beta features</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Try new tools first</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-purple-200 dark:border-purple-800">
                      <BookmarkCheck className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Save and Finish Later</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Resume quizzes anytime</div>
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

          {/* View Full Details Link */}
          <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              onClick={handleViewUpgradePage}
              variant="link"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
            >
              View full membership details and compare plans
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

