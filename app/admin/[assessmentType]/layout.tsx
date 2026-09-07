import { AssessmentProvider, type AssessmentType } from "@/context/assessment-context"
import type { ReactNode } from "react"

export default function AssessmentLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { assessmentType: string }
}) {
  // Validate and normalize the assessment type
  const validTypes: AssessmentType[] = ["quiz", "mid_semester", "final", "homework"]
  const assessmentType = validTypes.includes(params.assessmentType as AssessmentType)
    ? (params.assessmentType as AssessmentType)
    : "quiz"

  return <AssessmentProvider type={assessmentType}>{children}</AssessmentProvider>
}
