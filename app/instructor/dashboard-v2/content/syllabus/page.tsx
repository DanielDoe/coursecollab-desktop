"use client"

import { InstructorSyllabusPanel } from "@/components/instructor/syllabus/instructor-syllabus-panel"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function InstructorSyllabusPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorSyllabusPanel embedInDashboard />
    </StudentDashboardModulePage>
  )
}
