"use client"

import { InstructorPlaygroundManagement } from "@/components/instructor-playground-management"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function CoursePlaygroundPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorPlaygroundManagement embedInDashboard />
    </StudentDashboardModulePage>
  )
}
