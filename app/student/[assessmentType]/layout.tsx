import type React from "react"
import { AssessmentProvider, type AssessmentType } from "@/context/assessment-context"

export default async function StudentAssessmentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ assessmentType: string }>
}) {
  const { assessmentType } = await params

  return <AssessmentProvider type={assessmentType as AssessmentType}>{children}</AssessmentProvider>
}
