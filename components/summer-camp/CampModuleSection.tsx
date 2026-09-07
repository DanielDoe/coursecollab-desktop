"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Lock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"

type CampModuleSectionProps = {
  sectionNumber: number
  totalSections: number
  isLocked: boolean
  isComplete: boolean
  needsContinue: boolean
  onContinue?: () => void
  continuing?: boolean
  children: ReactNode
}

export function CampModuleSection({
  sectionNumber,
  totalSections,
  isLocked,
  isComplete,
  needsContinue,
  onContinue,
  continuing,
  children,
}: CampModuleSectionProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: isLocked ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative rounded-2xl",
        isLocked && "pointer-events-none select-none",
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            isComplete
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : isLocked
                ? "bg-slate-200/80 text-slate-500 dark:bg-white/10"
                : "bg-violet-500/15 text-violet-700 dark:text-violet-300",
          )}
        >
          {isComplete ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : isLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
          )}
          Section {sectionNumber} of {totalSections}
        </span>
        {isComplete && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Complete</span>
        )}
      </div>

      <div
        className={cn(
          "relative",
          isLocked && "max-h-[140px] overflow-hidden rounded-2xl",
        )}
      >
        {children}

        {isLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/20 dark:bg-black/40 backdrop-blur-[3px]">
            <div className="text-center px-6 py-5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-lg max-w-sm">
              <Lock className="h-8 w-8 text-violet-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-900 dark:text-white">Section locked</p>
              <p className="text-sm text-slate-500 mt-1">
                Finish section {sectionNumber - 1} to unlock this part of the lesson.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isLocked && needsContinue && !isComplete && onContinue && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={onContinue}
            disabled={continuing}
            className={cn("gap-1.5", camperCta)}
          >
            {continuing ? "Saving…" : "Continue to next section"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </motion.div>
  )
}
