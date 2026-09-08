"use client"

import type { CourseEvaluationNavSection } from "@/components/instructor/course-evaluation-shared"
import { CourseEvaluationOverviewPanel } from "@/components/instructor/course-evaluation-overview-panel"
import { CourseEvaluationEvaluationsPanel } from "@/components/instructor/course-evaluation-evaluations-panel"
import { CourseEvaluationPendingPanel } from "@/components/instructor/course-evaluation-pending-panel"

export type { CourseEvaluationNavSection } from "@/components/instructor/course-evaluation-shared"

export function InstructorCourseEvaluations({
  activeSection = "overview",
  onOpenEvaluations,
}: {
  activeSection?: CourseEvaluationNavSection
  onOpenEvaluations?: () => void
}) {
  if (activeSection === "evaluations") {
    return <CourseEvaluationEvaluationsPanel />
  }
  if (activeSection === "pending-approval") {
    return <CourseEvaluationPendingPanel onOpenEvaluations={onOpenEvaluations} />
  }
  return <CourseEvaluationOverviewPanel />
}
