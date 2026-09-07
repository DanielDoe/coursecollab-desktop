"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const CourseEvaluationDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/CourseEvaluationDashboardV2").then((m) => ({
      default: m.CourseEvaluationDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function CourseEvaluationPage() {
  return (
    <StudentDashboardModulePage>
      <CourseEvaluationDashboardV2 />
    </StudentDashboardModulePage>
  )
}
