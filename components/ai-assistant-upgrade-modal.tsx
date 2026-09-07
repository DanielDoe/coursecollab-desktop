"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState } from "react"
import { Sparkles, Crown, Gift, X, Brain, Code2, CheckCircle2, Lightbulb } from "lucide-react"
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
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

interface AIAssistantUpgradeModalProps {
  open: boolean
  onClose: () => void
  studentId?: number
}

export function AIAssistantUpgradeModal({ open, onClose, studentId }: AIAssistantUpgradeModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  const handleRemindMeLater = async () => {
    if (!studentId) {
      // If no studentId, just show toast and close
      toast({
        title: "Reminder Set!",
        description: "We'll remind you about upgrading to Trailblazer after your quiz.",
        className: "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200",
      })
      onClose()
      return
    }

    setIsSaving(true)
    try {
      const response = await studentApiFetch("/api/student/upgrade-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      })

      if (response.ok) {
        toast({
          title: "Reminder Set!",
          description: "We'll remind you about upgrading to Trailblazer after your quiz.",
          className: "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200",
        })
        onClose()
      } else {
        throw new Error("Failed to save reminder")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set reminder. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-full p-0">
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 p-4 sm:p-6 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold mb-1">
                AI Coding Assistant
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-xs sm:text-sm">
                Requires Trailblazer membership
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Enhanced Feature List */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              What you'll get:
            </h3>
            <div className="grid gap-2.5">
              <div className="flex items-start gap-2.5 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Step-by-Step Guidance</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Get structured hints broken down into actionable steps</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2.5 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Code2 className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Code Review & Syntax Help</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Get instant feedback on your code and syntax corrections</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2.5 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Pseudocode & Logic Hints</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Understand problem-solving approaches without getting full solutions</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2.5 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Error Pattern Recognition</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Identify common mistakes and learn from them</div>
                </div>
              </div>
            </div>
          </div>

          {/* Trailblazer Plan - Combined Monthly & Semester */}
          {trailblazerPlan && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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
                  onClick={handleRemindMeLater}
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  size="sm"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {isSaving ? "Setting Reminder..." : "Remind Me Later"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Donation Option - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/30 dark:via-pink-900/30 dark:to-rose-900/30"
          >
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-white">Support CourseCollab</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">14 days premium access</p>
                </div>
              </div>
              <Button
                onClick={handleRemindMeLater}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white"
                size="sm"
              >
                <Gift className="h-4 w-4 mr-2" />
                {isSaving ? "Setting Reminder..." : "Remind Me Later"}
              </Button>
            </div>
          </motion.div>

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
