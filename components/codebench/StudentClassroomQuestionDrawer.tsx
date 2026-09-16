"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpenCheck, Code2, Radio, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { parseClassroomSolutionQuestionConfig } from "@/lib/classroom-solution-submission"

export type StudentClassroomQuestionView = {
  title: string
  questionText: string
  description?: string | null
  session?: string | null
  isLive?: boolean
  questionConfig?: unknown
}

type Props = {
  open: boolean
  onClose: () => void
  assignment: StudentClassroomQuestionView | null
}

export function StudentClassroomQuestionDrawer({ open, onClose, assignment }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const questionConfig = assignment?.questionConfig
    ? parseClassroomSolutionQuestionConfig(assignment.questionConfig)
    : null

  return (
    <AnimatePresence>
      {open && assignment ? (
        <>
          <motion.button
            type="button"
            key="student-classroom-question-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close question panel"
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]"
          />
          <motion.aside
            key="student-classroom-question-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed right-0 top-16 z-[70] flex h-[calc(100vh-4rem)] w-full flex-col bg-[var(--card)] text-[var(--cc-text,var(--foreground))] shadow-2xl md:w-[min(100%,28rem)] lg:w-[min(100%,32rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                    {assignment.isLive ? "Live classroom" : "Classroom assignment"}
                  </p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-[var(--cc-text)]">{assignment.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {assignment.isLive ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <Radio className="mr-1 h-3 w-3" />
                        Live now
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="text-[10px]">
                      <Code2 className="mr-1 h-3 w-3" />
                      Code
                    </Badge>
                    {assignment.session ? (
                      <Badge variant="outline" className="text-[10px]">
                        {assignment.session}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                  <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
                  <span>Read the prompt below, then write and run your solution in the editor.</span>
                </div>

                {questionConfig?.question_media ? (
                  <QuestionMediaDisplay question={questionConfig} size="medium" />
                ) : null}

                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
                  <QuestionTextRenderer text={assignment.questionText} className="text-sm leading-relaxed" />
                </div>

                {assignment.description &&
                assignment.description.trim() !== assignment.questionText.trim() ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                      More details
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-[var(--cc-text-secondary,var(--cc-text))]">
                      {assignment.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
