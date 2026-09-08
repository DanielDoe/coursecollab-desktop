"use client"

import { LecturesManagement } from "@/components/lectures-management"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function ContentLecturesPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <LecturesManagement embedInDashboard />
    </StudentDashboardModulePage>
  )
}
