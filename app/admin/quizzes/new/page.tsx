"use client"

import { CreateQuizForm } from "@/components/create-quiz-form"
import { AdminHeader } from "@/components/admin-header"

export default function NewQuizPage() {
  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <CreateQuizForm />
      </main>
    </div>
  )
}
