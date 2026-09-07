"use client"

import { EditQuizForm } from "@/components/edit-quiz-form"
import { AdminHeader } from "@/components/admin-header"

export default function EditQuizPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <EditQuizForm quizId={params.id} />
      </main>
    </div>
  )
}
