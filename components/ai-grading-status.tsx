"use client"

import { motion } from "framer-motion"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type EvaluationSubject = "solution" | "code" | "submission"

interface AIGradingStatusProps {
  status: "idle" | "checking" | "success" | "error" | "partial"
  score?: number
  feedback?: string
  maxPoints?: number
  pointsEarned?: number
  onDismiss?: () => void
  showDismissButton?: boolean
  /** Wording for the in-progress evaluation message */
  evaluationSubject?: EvaluationSubject
}

const EVALUATION_LABELS: Record<EvaluationSubject, string> = {
  solution: "solution",
  code: "code",
  submission: "submission",
}

export function AIGradingStatus({
  status,
  score,
  feedback,
  maxPoints,
  pointsEarned,
  onDismiss,
  showDismissButton = false,
  evaluationSubject = "submission",
}: AIGradingStatusProps) {
  if (status === "idle") return null

  // Checking/Loading State
  if (status === "checking") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4"
      >
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-slate-500 dark:text-slate-400 animate-spin shrink-0" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Evaluating your {EVALUATION_LABELS[evaluationSubject]}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Success State - Persistent, no flashing
  if (status === "success") {
    return (
      <div className="mt-4">
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Quiz Master says: Excellent!
                  </h4>
                  {score !== undefined && (
                    <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white">
                      {score}%
                    </Badge>
                  )}
                  {pointsEarned !== undefined && maxPoints !== undefined && (
                    <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-300">
                      {pointsEarned.toFixed(1)}/{maxPoints} pts
                    </Badge>
                  )}
                  {showDismissButton && onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="ml-auto text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
                {feedback && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap">
                    {feedback}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Partial Credit State - Persistent, no flashing
  if (status === "partial") {
    return (
      <div className="mt-4">
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                    Quiz Master says: Good effort!
                  </h4>
                  {score !== undefined && (
                    <Badge className="bg-amber-600 dark:bg-amber-500 text-white">
                      {score}%
                    </Badge>
                  )}
                  {pointsEarned !== undefined && maxPoints !== undefined && (
                    <Badge variant="outline" className="border-amber-600 text-amber-700 dark:text-amber-300">
                      {pointsEarned.toFixed(1)}/{maxPoints} pts
                    </Badge>
                  )}
                  {showDismissButton && onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="ml-auto text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
                {feedback && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                    {feedback}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error/Incorrect State - Persistent, no flashing
  if (status === "error") {
    return (
      <div className="mt-4">
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                    Quiz Master says: Not quite right
                  </h4>
                  {score !== undefined && (
                    <Badge className="bg-red-600 dark:bg-red-500 text-white">
                      {score}%
                    </Badge>
                  )}
                  {pointsEarned !== undefined && maxPoints !== undefined && (
                    <Badge variant="outline" className="border-red-600 text-red-700 dark:text-red-300">
                      {pointsEarned.toFixed(1)}/{maxPoints} pts
                    </Badge>
                  )}
                  {showDismissButton && onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
                {feedback && (
                  <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
                    {feedback}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

