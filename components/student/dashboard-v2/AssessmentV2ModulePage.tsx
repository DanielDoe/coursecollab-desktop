"use client"

import dynamic from "next/dynamic"
import { AssessmentTypeProvider } from "@/context/assessment-type-context"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const AssessmentHubDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/AssessmentHubDashboardV2").then((m) => ({
      default: m.AssessmentHubDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

type AssessmentType = "quiz" | "homework" | "mid_semester" | "final"

export function AssessmentV2ModulePage({ assessmentType }: { assessmentType: AssessmentType }) {
  return (
    <AssessmentTypeProvider assessmentType={assessmentType}>
      <StudentDashboardModulePage>
        <AssessmentHubDashboardV2 />
      </StudentDashboardModulePage>
    </AssessmentTypeProvider>
  )
}
