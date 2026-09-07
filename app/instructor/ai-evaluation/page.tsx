"use client"

import { InstructorAiEvaluationManager } from "@/components/instructor-ai-evaluation-manager"
import { usePreventBack } from "@/hooks/use-prevent-back"

export default function InstructorAIEvaluationPage() {
  usePreventBack("/instructor/login")
  return <InstructorAiEvaluationManager variant="standalone" />
}
