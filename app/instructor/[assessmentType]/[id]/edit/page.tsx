"use client"

import { EditQuizForm } from "@/components/edit-quiz-form"
import { use } from "react"

interface EditAssessmentPageProps {
  params: Promise<{
    assessmentType: string
    id: string
  }>
}

export default function EditAssessmentPage({ params }: EditAssessmentPageProps) {
  const { id, assessmentType } = use(params)
  
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="container mx-auto px-4 py-8">
        <EditQuizForm quizId={id} assessmentType={assessmentType} />
      </main>
    </div>
  )
}

