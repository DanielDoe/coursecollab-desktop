"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleList } from "./ToggleList"

interface TutorSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  learningMemory?: Record<string, boolean>
  onLearningMemoryChange?: (id: string, value: boolean) => void
  onGenerateStudyPlan?: () => void
}

const learningMemoryItems = [
  { id: "remember-gaps", label: "Remember topics I struggle with" },
  { id: "detect-confusion", label: "Adapt when I seem confused" },
  { id: "remember-strengths", label: "Remember my strengths" },
  { id: "use-course-progress", label: "Use my course progress" },
  { id: "remember-preferences", label: "Keep my teaching preferences" },
]

export function TutorSettingsDrawer({
  isOpen,
  onClose,
  learningMemory = {
    "remember-gaps": true,
    "detect-confusion": true,
    "remember-strengths": true,
    "use-course-progress": true,
    "remember-preferences": true,
  },
  onLearningMemoryChange,
  onGenerateStudyPlan,
}: TutorSettingsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[85vw] sm:w-96 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-y-auto rounded-l-xl sm:rounded-l-2xl"
          >
            <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Cora preferences
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Quick memory toggles. Open the <strong>Preferences</strong> tab for full teaching
                pedagogy (formats, depth, and default behavior).
              </p>

              <ToggleList
                title="Adaptive memory"
                items={learningMemoryItems}
                values={learningMemory}
                onChange={onLearningMemoryChange}
              />

              <Button
                onClick={() => {
                  onGenerateStudyPlan?.()
                  onClose()
                }}
                className="w-full rounded-xl"
                variant="outline"
              >
                Generate study plan
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
