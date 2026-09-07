"use client"

import { useEffect, useState } from "react"
import { AlertCircle, HelpCircle, PartyPopper, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const EMOJI_OPTIONS = ["🔥", "💡", "🎯", "👏", "🤔", "❤️"]

interface CampModuleEngagementProps {
  moduleTitle: string
  isModuleComplete: boolean
  lessonReaction?: string | null
  onNeedHelp: () => void
  onConfused: () => void
  onReaction: (emoji: string) => void
  readOnly?: boolean
}

export function CampModuleEngagement({
  moduleTitle,
  isModuleComplete,
  lessonReaction,
  onNeedHelp,
  onConfused,
  onReaction,
  readOnly,
}: CampModuleEngagementProps) {
  const [showCelebration, setShowCelebration] = useState(false)
  const [confusedSent, setConfusedSent] = useState(false)

  useEffect(() => {
    if (isModuleComplete) setShowCelebration(true)
  }, [isModuleComplete])

  const handleConfused = () => {
    if (confusedSent) return
    setConfusedSent(true)
    onConfused()
  }

  return (
    <div className="space-y-3">
      {showCelebration && isModuleComplete && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <PartyPopper className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Mission milestone unlocked!</p>
            <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
              You completed <span className="font-medium">{moduleTitle}</span>. Keep going on your AI & Edge journey.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-3 sm:p-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span>React to this lesson</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={readOnly}
              onClick={() => onReaction(emoji)}
              className={cn(
                "size-9 rounded-lg text-lg transition-transform hover:scale-110",
                lessonReaction === emoji
                  ? "bg-violet-500/20 ring-2 ring-violet-500"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-violet-500/10",
              )}
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onNeedHelp} className="gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            Need Help?
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConfused}
            disabled={confusedSent}
            className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {confusedSent ? "Faculty notified" : "I'm confused"}
          </Button>
        </div>
      )}
    </div>
  )
}
