"use client"

import { useContext } from "react"
import { AssessmentContext } from "@/context/assessment-context"

export function useAssessment() {
  const context = useContext(AssessmentContext)

  if (!context) {
    // Return default values if context is not available
    return {
      type: "quiz",
      label: "Quiz",
    }
  }

  return context
}
