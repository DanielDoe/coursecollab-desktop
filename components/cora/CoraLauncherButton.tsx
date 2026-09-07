"use client"

import { Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CORA_SOLVE_LABEL } from "@/lib/cora/constants"
import type { CoraProblemContext } from "@/lib/cora/types"
import { useCoraOptional } from "@/components/cora/CoraProvider"
import {
  buildSolveHandoff,
  CORA_SOLVE_HREF,
  writeSolveHandoff,
} from "@/lib/cora/solve-handoff"
import { sourceLabelFor, type CoraSolveAssessmentState } from "@/lib/cora/solve-workspace"

type Props = {
  problem: CoraProblemContext
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  label?: string
  showIcon?: boolean
  /**
   * `solve` — open Cora Solve with problem preloaded (default).
   * `overlay` — legacy in-page CoraWorkspace when provider is present.
   */
  mode?: "solve" | "overlay"
  assessmentState?: CoraSolveAssessmentState
  intentLabel?: string
}

function assessmentStateForSource(
  source: CoraProblemContext["source"],
  override?: CoraSolveAssessmentState,
): CoraSolveAssessmentState {
  if (override) return override
  if (source === "quiz") return "active"
  if (source === "practice_hub" || source === "lecture_practice" || source === "lecture_workspace") {
    return "practice"
  }
  if (source === "codebench") return "practice"
  return "review"
}

export function CoraLauncherButton({
  problem,
  className,
  variant = "outline",
  size = "sm",
  label = CORA_SOLVE_LABEL,
  showIcon = true,
  mode = "solve",
  assessmentState,
  intentLabel,
}: Props) {
  const router = useRouter()
  const cora = useCoraOptional()
  const state = assessmentStateForSource(problem.source, assessmentState)
  const allowWorkedSolution = state !== "active"

  const openSolve = () => {
    const handoff = buildSolveHandoff({
      questionText: problem.questionText,
      title: problem.title,
      courseCode: problem.courseCode,
      topic: problem.topic,
      sourceModule: problem.source,
      sourceLabel: sourceLabelFor(problem.source),
      questionId: problem.questionId,
      bankQuestionId: problem.bankQuestionId,
      lectureId: problem.lectureId,
      quizId: problem.quizId,
      domain: problem.domain,
      assessmentState: state,
      allowWorkedSolution,
      intentLabel,
      studentDatabaseId: problem.studentDatabaseId,
      expectedAnswer: allowWorkedSolution ? problem.expectedAnswer : null,
      hint: problem.hint,
      explanation: allowWorkedSolution ? problem.explanation : null,
      referenceSteps: allowWorkedSolution ? problem.referenceSteps : undefined,
      mediaUrl: problem.mediaUrl,
    })
    writeSolveHandoff(handoff)
    router.push(CORA_SOLVE_HREF)
  }

  const onClick = () => {
    if (mode === "overlay" && cora) {
      cora.openCora(problem)
      return
    }
    openSolve()
  }

  if (mode === "overlay" && !cora) return null

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5 rounded-full", className)}
      onClick={onClick}
    >
      {showIcon ? <Sparkles className="h-3.5 w-3.5 shrink-0" /> : null}
      <span>{label}</span>
    </Button>
  )
}
