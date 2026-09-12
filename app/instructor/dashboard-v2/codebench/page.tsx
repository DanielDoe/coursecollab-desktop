"use client"

import { FacultyCodebenchHubDashboard } from "@/components/instructor/codebench/FacultyCodebenchHubDashboard"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function InstructorCodebenchPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <FacultyCodebenchHubDashboard />
      </div>
    </StudentDashboardModulePage>
  )
}
