"use client"

import InstructorProjectsPage from "@/app/instructor/projects/page"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function ManagementProjectsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorProjectsPage embedInDashboard />
    </StudentDashboardModulePage>
  )
}
