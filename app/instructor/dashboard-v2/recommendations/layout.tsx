"use client"

import type { ReactNode } from "react"
import { InstructorRecommendationModuleShell } from "@/components/instructor/recommendations/instructor-recommendations-module-shell"

export default function InstructorRecommendationsLayout({ children }: { children: ReactNode }) {
  return <InstructorRecommendationModuleShell>{children}</InstructorRecommendationModuleShell>
}
