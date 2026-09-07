"use client"

import dynamic from "next/dynamic"
import { ClassroomSolutionApprovalPreview } from "@/components/classroom-solution-approval-preview"

const LightCodeViewer = dynamic(
  () => import("@/components/light-code-viewer").then((m) => m.LightCodeViewer),
  { ssr: false },
)

export type ClassroomPointHistoryRow = {
  id: number
  category: string
  reason?: string | null
  ai_feedback?: unknown
  point_booster?: number | null
  submission_title?: string | null
  submission_code?: string | null
  plot_image?: string | null
  solution_answer_json?: unknown
  assignment_question_config?: unknown
}

export function classroomPointHasSubmissionDetails(point: ClassroomPointHistoryRow): boolean {
  if (point.category === "solution_submission") {
    return point.solution_answer_json != null
  }
  if (point.category === "code_submission") {
    return Boolean(point.submission_code?.trim() || point.plot_image?.trim())
  }
  return false
}

export function classroomPointHistoryTitle(point: ClassroomPointHistoryRow): string {
  return point.submission_title?.trim() || point.reason?.trim() || "Classroom points"
}

export function ClassroomPointHistoryDetail({ point }: { point: ClassroomPointHistoryRow }) {
  if (point.category === "solution_submission") {
    return (
      <ClassroomSolutionApprovalPreview
        assignmentQuestionConfig={point.assignment_question_config}
        solutionAnswerJson={point.solution_answer_json}
      />
    )
  }

  if (point.category === "code_submission") {
    return (
      <div className="space-y-4">
        {point.submission_code?.trim() ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              Submitted code
            </div>
            <LightCodeViewer value={point.submission_code} height="280px" />
          </div>
        ) : null}
        {point.plot_image?.trim() ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Submitted plot</p>
            <img
              src={point.plot_image}
              alt="Submitted plot"
              className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700"
            />
          </div>
        ) : null}
      </div>
    )
  }

  return null
}
