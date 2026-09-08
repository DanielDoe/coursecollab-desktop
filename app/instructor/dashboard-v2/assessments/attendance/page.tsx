"use client"

import { InstructorAttendanceContent } from "@/components/attendance/instructor-attendance-content"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function AssessmentsAttendancePage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorAttendanceContent embedInDashboard />
    </StudentDashboardModulePage>
  )
}
