"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { X, Crown, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

interface UpgradeReminderBannerProps {
  studentId: number
}

export function UpgradeReminderBanner({ studentId }: UpgradeReminderBannerProps) {
  const router = useRouter()
  const [showBanner, setShowBanner] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  useEffect(() => {
    const checkReminder = async () => {
      try {
        const response = await studentApiFetch(`/api/student/upgrade-reminder?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          // Check if there's an unread upgrade reminder
          if (data.hasReminder && !data.isDismissed) {
            setShowBanner(true)
          }
        }
      } catch (error) {
        console.error("[Upgrade Reminder Banner] Failed to check reminder:", error)
      }
    }

    if (studentId) {
      checkReminder()
    }
  }, [studentId])

  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      const response = await studentApiFetch(`/api/student/upgrade-reminder`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      })

      if (response.ok) {
        setShowBanner(false)
      }
    } catch (error) {
      console.error("[Upgrade Reminder Banner] Failed to dismiss:", error)
    } finally {
      setIsDismissing(false)
    }
  }

  const handleUpgrade = () => {
    router.push("/student/dashboard-v2/membership")
  }

  if (!showBanner) return null

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Alert className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-pink-900/30 border-2 border-purple-300 dark:border-purple-700 shadow-lg">
            <div className="flex items-start gap-3 w-full">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                      <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Upgrade to Trailblazer
                    </h3>
                    <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
                      Unlock AI Coding Assistant and other premium features. Get step-by-step guidance during exams!
                    </AlertDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-slate-500 hover:text-slate-700"
                    onClick={handleDismiss}
                    disabled={isDismissing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    onClick={handleUpgrade}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  >
                    Upgrade Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                    Save with semester plan
                  </Badge>
                </div>
              </div>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
