"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpenCheck, Calendar, Clock, Code2, PenLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import {
  CLASSROOM_SUBMISSION_KIND_CODE,
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
} from "@/lib/classroom-solution-submission"
import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  assignment: InstructorClassroomHandoff | null
}

export function useInstructorClassroomQuestionDrawer() {
  const [assignment, setAssignment] = useState<InstructorClassroomHandoff | null>(null)
  const [open, setOpen] = useState(false)

  const toggle = useCallback((next: InstructorClassroomHandoff) => {
    setOpen((isOpen) => {
      if (isOpen && assignment?.submissionId === next.submissionId) return false
      return true
    })
    setAssignment(next)
  }, [assignment])

  const close = useCallback(() => setOpen(false), [])

  return { assignment, open, toggle, close }
}

export function InstructorClassroomQuestionButton({
  open = false,
  onClick,
  className,
}: {
  open?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={open ? "secondary" : "outline"}
      className={cn("h-8 min-w-0 overflow-hidden px-2", className)}
      onClick={onClick}
      aria-pressed={open}
      title="Show the assignment question"
    >
      <BookOpenCheck className="mr-1 h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Question</span>
    </Button>
  )
}

function formatDueLabel(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InstructorClassroomQuestionDrawer({ open, onClose, assignment }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const dueLabel = formatDueLabel(assignment?.dueAt ?? null)
  const isCode = assignment?.submissionKind === CLASSROOM_SUBMISSION_KIND_CODE

  return (
    <AnimatePresence>
      {open && assignment ? (
        <>
          <motion.button
            type="button"
            key="classroom-question-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close question panel"
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]"
          />
          <motion.aside
            key="classroom-question-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed right-0 top-16 z-[70] flex h-[calc(100vh-4rem)] w-full flex-col bg-[var(--card)] shadow-2xl md:w-[min(100%,28rem)] lg:w-[min(100%,32rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                    Classroom assignment
                  </p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-[var(--cc-text)]">{assignment.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {isCode ? (
                        <>
                          <Code2 className="mr-1 h-3 w-3" />
                          Code
                        </>
                      ) : (
                        <>
                          <PenLine className="mr-1 h-3 w-3" />
                          Solution
                        </>
                      )}
                    </Badge>
                    {assignment.session ? (
                      <Badge variant="outline" className="text-[10px]">
                        {assignment.session}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        assignment.isActive
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                          : "text-[var(--cc-text-muted)]",
                      )}
                    >
                      {assignment.isActive ? "Active" : "Closed"}
                    </Badge>
                    {assignment.pointsHint != null ? (
                      <Badge variant="outline" className="text-[10px]">
                        up to {assignment.pointsHint} pts
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
              <div className="instructor-question-panel space-y-4">
                <div className="flex items-center gap-2 text-xs text-[var(--cc-text-muted)]">
                  <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
                  <span>Refer to this prompt while you code live with students.</span>
                </div>

                {assignment.questionConfig?.question_media ? (
                  <QuestionMediaDisplay question={assignment.questionConfig} size="medium" />
                ) : null}

                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
                  <QuestionTextRenderer text={assignment.questionText} className="text-sm leading-relaxed" />
                </div>

                {assignment.description &&
                assignment.submissionKind === CLASSROOM_SUBMISSION_KIND_CODE &&
                assignment.description.trim() !== assignment.questionText.trim() ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                      Instructor notes
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-[var(--cc-text-muted)]">{assignment.description}</p>
                  </div>
                ) : null}

                {assignment.questionConfig?.expected_answer ? (
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--cc-warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--cc-warning)_6%,var(--card))] p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                      Expected answer (instructor only)
                    </p>
                    <QuestionTextRenderer
                      text={assignment.questionConfig.expected_answer}
                      className="text-sm leading-relaxed"
                    />
                  </div>
                ) : null}

                <div className="grid gap-2 text-xs text-[var(--cc-text-muted)] sm:grid-cols-2">
                  {dueLabel ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Due {dueLabel}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{assignment.starterFileName} · {assignment.languageId.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
