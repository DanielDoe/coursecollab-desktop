"use client"

import { AssessmentProvider } from "@/context/assessment-context"
import { InstructorQuizManagement } from "@/components/instructor-quiz-management"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function AssessmentsMidSemesterPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <AssessmentProvider type="mid_semester">
        <InstructorQuizManagement embedInDashboard />
      </AssessmentProvider>
    </StudentDashboardModulePage>
  )
}
