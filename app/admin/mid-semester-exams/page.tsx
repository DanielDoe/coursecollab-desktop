"use client"

import { QuizManagement } from "@/components/quiz-management"
import { AdminHeader } from "@/components/admin-header"

export default function AdminMidSemesterExamsPage() {
  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <QuizManagement assessmentType="mid_semester" />
      </main>
    </div>
  )
}
