"use client"

import { InstructorFlashcardsPanel } from "@/components/instructor/flashcards/instructor-flashcards-panel"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function ContentFlashcardsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorFlashcardsPanel />
    </StudentDashboardModulePage>
  )
}
