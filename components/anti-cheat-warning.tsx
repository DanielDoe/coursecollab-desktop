"use client"

import { useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AntiCheatWarningProps {
  show: boolean
  message: string
  type: "tab_switch" | "copy_paste" | "mouse_leave" | "gemini_window" | null
  onClose: () => void
  violationCount?: number
  maxViolations?: number
  isBlocking?: boolean
  isCleared?: boolean
  onManualDismiss?: () => void
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
  useEffect(() => {
    if (type === "gemini_window") {
      console.log("[AntiCheatWarning] Gemini warning state:", {
        show,
        isBlocking,
        isCleared,
        violationCount,
        maxViolations,
      })
    }
  }, [show, isBlocking, isCleared, type, violationCount, maxViolations])

  if (!show) return null

  const effectivelyBlocking =
    type !== "tab_switch" && type !== "copy_paste" && isBlocking && !isCleared

  const severity =
    violationCount >= maxViolations * 0.8
      ? "critical"
      : violationCount >= maxViolations * 0.5
        ? "high"
        : "medium"

  const panelClass = cn(
    "rounded-2xl border-2 p-6 shadow-2xl",
    severity === "critical"
      ? "border-red-500/70 bg-red-50 dark:border-red-400/60 dark:bg-red-950/80"
      : severity === "high"
        ? "border-orange-500/70 bg-orange-50 dark:border-orange-400/55 dark:bg-orange-950/75"
        : "border-amber-500/70 bg-amber-50 dark:border-amber-400/55 dark:bg-amber-950/75",
  )

  const titleClass =
    severity === "critical"
      ? "text-red-950 dark:text-red-50"
      : severity === "high"
        ? "text-orange-950 dark:text-orange-50"
        : "text-amber-950 dark:text-amber-50"

  const bodyClass =
    severity === "critical"
      ? "text-red-900/95 dark:text-red-100/95"
      : severity === "high"
        ? "text-orange-900/95 dark:text-orange-100/95"
        : "text-amber-900/95 dark:text-amber-100/95"

  const iconClass =
    severity === "critical"
      ? "text-red-600 dark:text-red-300"
      : severity === "high"
        ? "text-orange-600 dark:text-orange-300"
        : "text-amber-600 dark:text-amber-300"

  const progressClass =
    severity === "critical"
      ? "bg-red-600"
      : severity === "high"
        ? "bg-orange-600"
        : "bg-amber-500"

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-[9998] bg-black/75 backdrop-blur-md"
            onClick={effectivelyBlocking ? undefined : onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="pointer-events-auto fixed left-1/2 top-1/2 z-[9999] mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className={cn(panelClass, "relative")}>
              {!effectivelyBlocking && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn("absolute right-4 top-4 transition-opacity hover:opacity-70", iconClass)}
                  aria-label="Close warning"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              <div className="flex items-start gap-4">
                <div className={cn("mt-1 shrink-0", iconClass)}>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, -8, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                  >
                    <AlertTriangle className="h-8 w-8" />
                  </motion.div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className={cn("mb-2 text-lg font-bold", titleClass)}>
                    {type === "gemini_window" ? "Browser AI tool detected" : "Assessment integrity warning"}
                  </h3>
                  <p className={cn("mb-4 text-sm leading-relaxed", bodyClass)}>{message}</p>

                  {(type === "tab_switch" || type === "gemini_window") && maxViolations > 0 && (
                    <div className="mb-4">
                      <div className={cn("mb-1 flex items-center justify-between text-xs font-medium", bodyClass)}>
                        <span>
                          {type === "gemini_window" ? "Gemini strikes" : "Tab switches"}: {violationCount} /{" "}
                          {maxViolations}
                        </span>
                        <span>{Math.max(0, maxViolations - violationCount)} remaining</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/15">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(violationCount / maxViolations) * 100}%` }}
                          className={cn("h-2 rounded-full", progressClass)}
                        />
                      </div>
                    </div>
                  )}

                  {violationCount >= maxViolations * 0.8 && (
                    <div className="mb-4 rounded-lg border border-red-400/50 bg-red-100/90 p-3 dark:border-red-400/40 dark:bg-red-900/50">
                      <p className="text-xs font-semibold text-red-950 dark:text-red-50">
                        Critical: you are approaching the maximum allowed violations ({violationCount}/{maxViolations}).
                        {violationCount >= maxViolations ? (
                          <span className="mt-1 block">
                            Maximum violations reached. Your assessment may be submitted automatically.
                          </span>
                        ) : (
                          <span className="mt-1 block">
                            One more violation may trigger automatic submission.
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {effectivelyBlocking && onManualDismiss ? (
                    <div className="space-y-2">
                      <Button
                        onClick={onManualDismiss}
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        I closed the AI tool — continue quiz
                      </Button>
                      <p className="text-center text-xs text-[var(--cc-text-muted)]">
                        Click after you have closed the AI tool window to continue.
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={onClose}
                      disabled={effectivelyBlocking}
                      className={cn(
                        "w-full text-white disabled:cursor-not-allowed disabled:opacity-50",
                        severity === "critical"
                          ? "bg-red-600 hover:bg-red-700"
                          : severity === "high"
                            ? "bg-orange-600 hover:bg-orange-700"
                            : "bg-amber-600 hover:bg-amber-700",
                      )}
                    >
                      {effectivelyBlocking ? "Close the AI tool to continue" : "I understand"}
                    </Button>
                  )}

                  {effectivelyBlocking && !onManualDismiss && (
                    <p className="mt-2 text-center text-xs text-[var(--cc-text-muted)]">
                      The quiz is paused. Close the AI tool window to continue.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/15">
                <p className={cn("text-xs leading-relaxed", bodyClass)}>
                  <strong>Note:</strong> Activity during this assessment is monitored for academic integrity. Stay on
                  this page and avoid external tools until you finish.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
