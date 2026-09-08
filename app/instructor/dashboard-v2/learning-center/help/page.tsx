"use client"

import { InstructorHelpCenterContent } from "@/app/instructor/help-center/page"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function LearningCenterHelpPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorHelpCenterContent embedInDashboard />
    </StudentDashboardModulePage>
  )
}
