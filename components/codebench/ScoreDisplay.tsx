"use client"

import { Trophy, Star, Target, TrendingUp, Award, CheckCircle2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

interface ScoreDisplayProps {
  score: number // 0-10
  maxScore?: number // Default 10
  pointsAwarded?: number
  maxPoints?: number
  feedback?: string
  showSubmitButton?: boolean
  onSubmit?: () => void
  isSubmitting?: boolean
  performanceLevel?: "excellent" | "good" | "fair" | "needs-improvement"
}

export function ScoreDisplay({
  score,
  maxScore = 10,
  pointsAwarded,
  maxPoints,
  feedback,
  showSubmitButton = false,
  onSubmit,
  isSubmitting = false,
  performanceLevel,
}: ScoreDisplayProps) {
  // Track when ScoreDisplay is rendered
  useEffect(() => {
    // ScoreDisplay visibility is handled by parent component
  }, [score, maxScore, pointsAwarded, maxPoints, feedback, showSubmitButton, onSubmit, isSubmitting, performanceLevel])
  
  const percentage = (score / maxScore) * 100
  
  // Determine performance level based on score
  const getPerformanceLevel = (): {
    level: "excellent" | "good" | "fair" | "needs-improvement"
    label: string
    icon: React.ReactNode
    color: string
    bgGradient: string
    borderColor: string
    badgeColor: string
    badgeText: string
  } => {
    if (performanceLevel) {
      // Use provided performance level
      const levels = {
        excellent: {
          level: "excellent" as const,
          label: "Excellent Work!",
          icon: <Trophy className="h-6 w-6" />,
          color: "text-yellow-400",
          bgGradient: "from-slate-800/80 to-slate-900/80",
          borderColor: "border-slate-700/60",
          badgeColor: "bg-gradient-to-r from-yellow-400 to-amber-500",
          badgeText: "🏆 Excellent",
        },
        good: {
          level: "good" as const,
          label: "Great Job!",
          icon: <Star className="h-6 w-6" />,
          color: "text-green-400",
          bgGradient: "from-slate-800/80 to-slate-900/80",
          borderColor: "border-slate-700/60",
          badgeColor: "bg-gradient-to-r from-green-400 to-emerald-500",
          badgeText: "⭐ Great",
        },
        fair: {
          level: "fair" as const,
          label: "Good Effort!",
          icon: <Target className="h-6 w-6" />,
          color: "text-blue-400",
          bgGradient: "from-slate-800/80 to-slate-900/80",
          borderColor: "border-slate-700/60",
          badgeColor: "bg-gradient-to-r from-blue-400 to-cyan-500",
          badgeText: "🎯 Good",
        },
        "needs-improvement": {
          level: "needs-improvement" as const,
          label: "Keep Practicing!",
          icon: <TrendingUp className="h-6 w-6" />,
          color: "text-purple-400",
          bgGradient: "from-slate-800/80 to-slate-900/80",
          borderColor: "border-slate-700/60",
          badgeColor: "bg-gradient-to-r from-purple-400 to-pink-500",
          badgeText: "📈 Keep Going",
        },
      }
      return levels[performanceLevel]
    }
    
    // Auto-determine based on percentage
    if (percentage >= 90) {
      return {
        level: "excellent",
        label: "Excellent Work!",
        icon: <Trophy className="h-6 w-6" />,
        color: "text-yellow-400",
        bgGradient: "from-slate-800/80 to-slate-900/80",
        borderColor: "border-slate-700/60",
        badgeColor: "bg-gradient-to-r from-yellow-400 to-amber-500",
        badgeText: "🏆 Excellent",
      }
    } else if (percentage >= 70) {
      return {
        level: "good",
        label: "Great Job!",
        icon: <Star className="h-6 w-6" />,
        color: "text-green-400",
        bgGradient: "from-slate-800/80 to-slate-900/80",
        borderColor: "border-slate-700/60",
        badgeColor: "bg-gradient-to-r from-green-400 to-emerald-500",
        badgeText: "⭐ Great",
      }
    } else if (percentage >= 50) {
      return {
        level: "fair",
        label: "Good Effort!",
        icon: <Target className="h-6 w-6" />,
        color: "text-blue-400",
        bgGradient: "from-slate-800/80 to-slate-900/80",
        borderColor: "border-slate-700/60",
        badgeColor: "bg-gradient-to-r from-blue-400 to-cyan-500",
        badgeText: "🎯 Good",
      }
    } else {
      return {
        level: "needs-improvement",
        label: "Keep Practicing!",
        icon: <TrendingUp className="h-6 w-6" />,
        color: "text-purple-400",
        bgGradient: "from-slate-800/80 to-slate-900/80",
        borderColor: "border-slate-700/60",
        badgeColor: "bg-gradient-to-r from-purple-400 to-pink-500",
        badgeText: "📈 Keep Going",
      }
    }
  }

  const performance = getPerformanceLevel()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full"
    >
      <Card className={cn(
        "bg-gradient-to-br from-slate-800/80 to-slate-900/80",
        "border border-slate-700/60",
        "shadow-xl rounded-2xl text-slate-100",
        "overflow-hidden"
      )}>
        <div className="p-6 space-y-4">
          {/* Header with Icon and Performance Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className={cn("p-3 rounded-xl bg-slate-800/60", performance.color)}
              >
                {performance.icon}
              </motion.div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1 drop-shadow-sm">
                  {performance.label}
                </h3>
                <Badge className={cn(performance.badgeColor, "text-white border-0 shadow-lg")}>
                  {performance.badgeText}
                </Badge>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-right"
            >
              <div className="text-4xl font-bold text-slate-100 mb-1">
                {score.toFixed(1)}
                <span className="text-xl text-slate-300">/{maxScore}</span>
              </div>
              <div className="text-sm text-slate-200 font-semibold">
                {percentage.toFixed(0)}%
              </div>
            </motion.div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-slate-300 uppercase tracking-wide font-semibold">Score</span>
              </div>
              <div className="text-lg font-bold text-slate-100">
                {score.toFixed(1)} / {maxScore}
              </div>
            </div>
            {pointsAwarded !== undefined && maxPoints !== undefined && (
              <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-slate-300 uppercase tracking-wide font-semibold">Points</span>
                </div>
                <div className="text-lg font-bold text-slate-100">
                  {pointsAwarded.toFixed(2)} / {maxPoints.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Pending approval
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
              <span>Performance</span>
              <span className="text-slate-100 font-semibold">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  performance.badgeColor,
                  "shadow-lg"
                )}
              />
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200 mb-1">Evaluation Summary</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{feedback}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          {showSubmitButton && onSubmit && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-2"
            >
              <button
                onClick={() => {
                  if (!onSubmit) {
                    console.error("[ScoreDisplay] ❌ onSubmit callback is not defined!")
                    return
                  }
                  
                  if (isSubmitting) {
                    return
                  }
                  
                  try {
                    onSubmit()
                  } catch (error) {
                    console.error("[ScoreDisplay] ❌ Error in onSubmit callback:", error)
                  }
                }}
                disabled={isSubmitting}
                className={cn(
                  "w-full py-3 px-4 rounded-lg font-semibold text-white",
                  "transition-all duration-200",
                  "shadow-lg hover:shadow-xl",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  performance.badgeColor,
                  "hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2 text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 text-white">
                    <Award className="h-4 w-4" />
                    Submit for Instructor Approval
                  </span>
                )}
              </button>
              {isSubmitting && (
                <p className="text-xs text-slate-300 text-center mt-2 font-medium">
                  Your submission will be reviewed by your instructor
                </p>
              )}
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

