"use client"

import { AssessmentProvider } from "@/context/assessment-context"
import { InstructorQuizManagement } from "@/components/instructor-quiz-management"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function AssessmentsQuizzesManagePage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <AssessmentProvider type="quiz">
        <InstructorQuizManagement embedInDashboard />
      </AssessmentProvider>
    </StudentDashboardModulePage>
  )
}
