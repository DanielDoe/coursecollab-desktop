"use client"

import { CheckCircle2, Circle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SectionConfig } from "@/lib/assessment-sections"
import type { QuestionSection } from "@/lib/assessment-sections"
import {
  countSelectedForSection,
  sectionPickRequiredCount,
  sectionUsesStudentPick,
  getSectionConfigForSectionIndex,
  type SectionQuestionSelections,
} from "@/lib/section-pick-scoring"

type QuestionRow = { id: number }

export function sectionHasStudentPick(
  sectionIndex: number,
  sectionConfig: SectionConfig[] | null | undefined,
): boolean {
  return sectionUsesStudentPick(getSectionConfigForSectionIndex(sectionIndex, sectionConfig))
}

export function isQuestionSelectedForGrading(
  sectionIndex: number,
  questionId: number,
  selections: SectionQuestionSelections,
): boolean {
  return selections[sectionIndex]?.includes(questionId) ?? false
}

export function toggleSectionQuestionSelection(
  selections: SectionQuestionSelections,
  sectionIndex: number,
  questionId: number,
  required: number,
): { next: SectionQuestionSelections; error?: string } {
  const current = selections[sectionIndex] ?? []
  const isSelected = current.includes(questionId)
  if (isSelected) {
    const nextList = current.filter((id) => id !== questionId)
    const next = { ...selections }
    if (nextList.length) next[sectionIndex] = nextList
    else delete next[sectionIndex]
    return { next }
  }
  if (current.length >= required) {
    return {
      next: selections,
      error: `You can only select ${required} question${required === 1 ? "" : "s"} for grading in this section.`,
    }
  }
  return { next: { ...selections, [sectionIndex]: [...current, questionId] } }
}

interface SectionQuestionPickBannerProps {
  section: QuestionSection
  sectionConfig: SectionConfig[] | null | undefined
  selections: SectionQuestionSelections
  questionCountInSection: number
}

export function SectionQuestionPickBanner({
  section,
  sectionConfig,
  selections,
  questionCountInSection,
}: SectionQuestionPickBannerProps) {
  const required = sectionPickRequiredCount(section.sectionIndex, sectionConfig)
  if (!required) return null
  const selected = countSelectedForSection(section.sectionIndex, selections)
  const complete = selected >= required

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        complete
          ? "border-emerald-300/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-amber-300/60 bg-amber-50/80 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
      }`}
    >
      <p className="font-medium">
        Choose any <strong>{required}</strong> of {questionCountInSection} questions in this section for grading.
      </p>
      <p className="mt-1 text-xs opacity-90">
        Your section score uses only the questions you mark as selected ({selected}/{required} selected).
        Unselected questions do not count toward your grade denominator.
      </p>
    </div>
  )
}

interface SectionQuestionPickToggleProps {
  sectionIndex: number
  questionId: number
  sectionConfig: SectionConfig[] | null | undefined
  selections: SectionQuestionSelections
  disabled?: boolean
  onToggle: (next: SectionQuestionSelections) => void
  onLimitReached?: (message: string) => void
}

export function SectionQuestionPickToggle({
  sectionIndex,
  questionId,
  sectionConfig,
  selections,
  disabled,
  onToggle,
  onLimitReached,
}: SectionQuestionPickToggleProps) {
  const required = sectionPickRequiredCount(sectionIndex, sectionConfig)
  if (!required) return null
  const selected = isQuestionSelectedForGrading(sectionIndex, questionId, selections)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        className={
          selected
            ? "bg-violet-600 hover:bg-violet-700 text-white gap-2"
            : "gap-2 border-violet-300 text-violet-800 dark:border-violet-700 dark:text-violet-200"
        }
        onClick={() => {
          const { next, error } = toggleSectionQuestionSelection(
            selections,
            sectionIndex,
            questionId,
            required,
          )
          if (error) {
            onLimitReached?.(error)
            return
          }
          onToggle(next)
        }}
      >
        {selected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        {selected ? "Selected for grading" : "Select for grading"}
      </Button>
      {selected && (
        <Badge variant="secondary" className="text-xs">
          Counts toward your {required}-question section score
        </Badge>
      )}
    </div>
  )
}

interface SectionPickNavigatorHintProps {
  section: QuestionSection
  sectionConfig: SectionConfig[] | null | undefined
  selections: SectionQuestionSelections
}

export function SectionPickNavigatorHint({
  section,
  sectionConfig,
  selections,
}: SectionPickNavigatorHintProps) {
  const required = sectionPickRequiredCount(section.sectionIndex, sectionConfig)
  if (!required) return null
  const selected = countSelectedForSection(section.sectionIndex, selections)
  return (
    <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
      Grading set: {selected}/{required}
    </span>
  )
}
