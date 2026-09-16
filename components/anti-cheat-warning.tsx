"use client"

import { useEffect } from "react"
import { AlertTriangle, X, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"

interface AntiCheatWarningProps {
  show: boolean
  message: string
  type: "tab_switch" | "copy_paste" | "mouse_leave" | "gemini_window" | null
  onClose: () => void
  violationCount?: number
  maxViolations?: number
  isBlocking?: boolean // If true, prevents dismissal until violation is cleared
  isCleared?: boolean // Indicates if the violation condition is cleared
  onManualDismiss?: () => void // Manual dismissal callback for when automatic detection fails
}

export function AntiCheatWarning({
  show,
  message,
  type,
  onClose,
  violationCount = 0,
  maxViolations = 5,
  isBlocking = false,
  isCleared = false,
  onManualDismiss,
}: AntiCheatWarningProps) {
  // Debug logging for Gemini warnings
  useEffect(() => {
    if (type === "gemini_window") {
      console.log("[AntiCheatWarning] Gemini warning state:", {
        show,
        isBlocking,
        isCleared,
        violationCount,
        maxViolations
      })
    }
  }, [show, isBlocking, isCleared, type, violationCount, maxViolations])

  if (!show) return null

  // Tab switch and copy_paste warnings are always dismissible (never trap Scholars)
  const effectivelyBlocking = type !== "tab_switch" && type !== "copy_paste" && isBlocking && !isCleared

  const getColorClasses = () => {
    if (violationCount >= maxViolations * 0.8) {
      return {
        bg: "bg-red-50 dark:bg-red-900/30",
        border: "border-red-500 dark:border-red-700",
        text: "text-red-900 dark:text-red-100",
        icon: "text-red-600 dark:text-red-400",
      }
    } else if (violationCount >= maxViolations * 0.5) {
      return {
        bg: "bg-orange-50 dark:bg-orange-900/30",
        border: "border-orange-500 dark:border-orange-700",
        text: "text-orange-900 dark:text-orange-100",
        icon: "text-orange-600 dark:text-orange-400",
      }
    }
    return {
      bg: "bg-yellow-50 dark:bg-yellow-900/30",
      border: "border-yellow-500 dark:border-yellow-700",
      text: "text-yellow-900 dark:text-yellow-100",
      icon: "text-yellow-600 dark:text-yellow-400",
    }
  }

  const colors = getColorClasses()

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9998]"
            onClick={effectivelyBlocking ? undefined : onClose}
          />

          {/* Warning Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md mx-4"
          >
            <div
              className={`${colors.bg} ${colors.border} border-2 rounded-2xl shadow-2xl p-6 relative`}
            >
              {/* Close Button - disabled if blocking and not cleared */}
              {(!effectivelyBlocking) && (
                <button
                  onClick={onClose}
                  className={`absolute top-4 right-4 ${colors.icon} hover:opacity-70 transition-opacity`}
                  aria-label="Close warning"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {/* Icon */}
              <div className="flex items-start gap-4">
                <div className={`${colors.icon} flex-shrink-0 mt-1`}>
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, -10, 10, -10, 0],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: 2,
                    }}
                  >
                    <AlertTriangle className="h-8 w-8" />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
                    {type === "gemini_window" ? "Browser AI Tool Detected" : "Assessment Integrity Warning"}
                  </h3>
                  <p className={`${colors.text} text-sm leading-relaxed mb-4`}>
                    {message}
                  </p>

                  {/* Violation Counter */}
                  {(type === "tab_switch" || type === "gemini_window") && maxViolations > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={colors.text}>
                          {type === "gemini_window" ? "Gemini Strikes" : "Tab Switches"}: {violationCount} / {maxViolations}
                        </span>
                        <span className={colors.text}>
                          {maxViolations - violationCount} remaining
                        </span>
                      </div>
                      <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(violationCount / maxViolations) * 100}%`,
                          }}
                          className={`h-2 rounded-full ${
                            violationCount >= maxViolations * 0.8
                              ? "bg-red-600"
                              : violationCount >= maxViolations * 0.5
                              ? "bg-orange-600"
                              : "bg-yellow-600"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Warning Message */}
                  {violationCount >= maxViolations * 0.8 && (
                    <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-3 mb-4">
                      <p className="text-xs text-red-900 dark:text-red-100 font-semibold">
                        🚨 CRITICAL WARNING: You are approaching the maximum allowed violations ({violationCount}/{maxViolations}). 
                        {violationCount >= maxViolations && (
                          <span className="block mt-1 text-red-800 dark:text-red-200">
                            MAXIMUM VIOLATIONS REACHED! Your assessment will be automatically submitted.
                          </span>
                        )}
                        {violationCount < maxViolations && (
                          <span className="block mt-1">
                            One more violation will trigger automatic submission of your assessment.
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {effectivelyBlocking && onManualDismiss ? (
                    // Show manual dismissal button when blocking and not cleared
                    <div className="space-y-2">
                      <Button
                        onClick={onManualDismiss}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        ✓ I Have Closed the AI Tool - Continue Quiz
                      </Button>
                      <p className="text-xs text-center text-slate-600 dark:text-slate-400">
                        Click this button after you have closed the AI tool window to continue the quiz.
                      </p>
                    </div>
                  ) : (
                    // Show regular close button when not blocking or cleared
                    <Button
                      onClick={onClose}
                      disabled={effectivelyBlocking}
                      className={`w-full ${
                        violationCount >= maxViolations * 0.8
                          ? "bg-red-600 hover:bg-red-700"
                          : violationCount >= maxViolations * 0.5
                          ? "bg-orange-600 hover:bg-orange-700"
                          : "bg-yellow-600 hover:bg-yellow-700"
                      } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {effectivelyBlocking 
                        ? "Please close the AI tool to continue" 
                        : "I Understand"}
                    </Button>
                  )}
                  {effectivelyBlocking && !onManualDismiss && (
                    <div className="text-xs text-center mt-2 space-y-1">
                      <p className="text-slate-600 dark:text-slate-400">
                        The quiz is paused. Close the AI tool window to continue.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-4 pt-4 border-t border-current/20">
                <p className={`text-xs ${colors.text} opacity-75`}>
                  <strong>Note:</strong> All activities during this assessment are being monitored
                  for academic integrity. Please focus on the assessment and avoid switching tabs
                  or using external resources.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

