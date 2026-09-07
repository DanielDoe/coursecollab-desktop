"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface CodebenchSuccessData {
  score: number
  pointsAwarded: number
  isAssignment?: boolean
}

interface Codebench2xMultiplierModalProps {
  open: boolean
  onClose: () => void
  data: CodebenchSuccessData | null
}

/** Custom modal shown after CodeBench submission. When isAssignment, highlights 2x Trailblazer multiplier to encourage membership. */
export function Codebench2xMultiplierModal({
  open,
  onClose,
  data,
}: Codebench2xMultiplierModalProps) {
  const isAssignment = data?.isAssignment ?? false
  const points = data?.pointsAwarded ?? 2.5
  const score = data?.score ?? 0

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={cn(
                "rounded-2xl shadow-2xl max-w-md w-full overflow-hidden pointer-events-auto",
                "bg-white dark:bg-slate-900 border-2",
                isAssignment
                  ? "border-amber-300 dark:border-amber-600"
                  : "border-green-200 dark:border-green-800"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 2x Multiplier hero - only for assignments */}
              {isAssignment && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className="relative bg-gradient-to-br from-amber-400/20 via-amber-500/15 to-orange-500/20 dark:from-amber-500/25 dark:via-amber-600/20 dark:to-orange-600/25 border-b border-amber-200/50 dark:border-amber-700/50 px-6 pt-6 pb-4"
                >
                  <div className="absolute inset-0 overflow-hidden rounded-t-2xl pointer-events-none">
                    <motion.div
                      animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.15, 0.25, 0.15],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                      }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-amber-400"
                    />
                  </div>
                  <div className="relative flex flex-col items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 18,
                        delay: 0.15,
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/90 dark:bg-amber-600/90 text-amber-950 dark:text-amber-50 font-bold text-lg shadow-lg shadow-amber-500/30"
                    >
                      <Zap className="h-5 w-5" />
                      <span>2× POINTS</span>
                      <Sparkles className="h-4 w-4" />
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-sm font-medium text-amber-800 dark:text-amber-200 text-center"
                    >
                      Trailblazer benefit: CodeBench assignments earn double points.
                    </motion.p>
                  </div>
                </motion.div>
              )}

              <div className="p-6 sm:p-8">
                <div className="flex flex-col items-center text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                      delay: isAssignment ? 0.25 : 0,
                    }}
                    className={cn(
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg",
                      isAssignment
                        ? "bg-gradient-to-br from-green-400 to-emerald-600"
                        : "bg-gradient-to-br from-green-400 to-green-600"
                    )}
                  >
                    <CheckCircle2 className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      Code Submitted Successfully!
                    </h3>
                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
                      Your code has been submitted for instructor review.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-500 mt-2">
                      You&apos;ll receive{" "}
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {points.toFixed(2)} points
                      </span>{" "}
                      after approval.
                    </p>
                    {data && (
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Evaluation Score: {score}/10
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  >
                    Got it!
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
