"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import { CC_MODAL_SCRIM, CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui"
import { cn } from "@/lib/utils"

interface PointBoosterModalProps {
  isOpen: boolean
  onClose: () => void
  pointBooster?: number
  pointsAwarded?: number
  boosterLabel?: string
  autoApproved?: boolean
  instructorFeedback?: string | null
}

export function PointBoosterModal({
  isOpen,
  onClose,
  pointBooster = 1,
  pointsAwarded = 2.5,
  boosterLabel = "x1",
  autoApproved = false,
  instructorFeedback = null,
}: PointBoosterModalProps) {
  const isBoosted = pointBooster > 1
  const boosterColor =
    pointBooster >= 3
      ? "from-amber-500 to-orange-500"
      : pointBooster >= 2
        ? "from-emerald-500 to-teal-500"
        : "from-slate-400 to-slate-500"

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("z-[200]", CC_MODAL_SCRIM)}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={cn(
                "rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-green-200 dark:border-green-800 pointer-events-auto",
                CC_MODAL_SURFACE,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Success header */}
              <div className="p-6 sm:p-8 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center shadow-lg mx-auto mb-4"
                >
                  <CheckCircle2 className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2"
                >
                  Code Submitted Successfully!
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-base text-slate-600 dark:text-slate-400 mb-4 space-y-2"
                >
                  <span className="block">
                    {autoApproved
                      ? "Your submission was recorded with a provisional score."
                      : "Your submission was evaluated by AI for instructor feedback."}
                  </span>
                  <ClassroomProvisionalScoreBadge className="mx-auto" />
                  <span className="block text-sm text-amber-800/90 dark:text-amber-200/90">
                    Final points are confirmed by your instructor — the AI score is not final.
                  </span>
                </motion.p>
                {instructorFeedback ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.22 }}
                    className="text-sm text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 mb-4 text-slate-700 dark:text-slate-200"
                  >
                    <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Instructor feedback
                    </strong>
                    <AiFeedbackMarkdown
                      text={instructorFeedback}
                      className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                    />
                  </motion.div>
                ) : null}

                {/* Point booster badge - animated */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.25 }}
                  className="inline-flex flex-col items-center gap-2"
                >
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${boosterColor} text-white font-bold shadow-lg ${
                      isBoosted ? "animate-pulse" : ""
                    }`}
                  >
                    {isBoosted && (
                      <motion.span
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </motion.span>
                    )}
                    <span className="text-lg sm:text-xl">
                      {pointBooster}× Point Booster
                    </span>
                    {isBoosted && (
                      <motion.span
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                      >
                        <Zap className="h-5 w-5" />
                      </motion.span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {boosterLabel}
                  </p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-base font-semibold text-green-600 dark:text-green-400"
                  >
                    {autoApproved ? (
                      <>
                        <span className="font-bold">{pointsAwarded} provisional points</span> recorded
                      </>
                    ) : (
                      <>
                        Up to <span className="font-bold">{pointsAwarded} provisional points</span> after
                        instructor approval
                      </>
                    )}
                  </motion.p>
                </motion.div>
              </div>

              <div className="px-6 pb-6">
                <Button
                  onClick={onClose}
                  className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white rounded-xl"
                >
                  Got it!
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
