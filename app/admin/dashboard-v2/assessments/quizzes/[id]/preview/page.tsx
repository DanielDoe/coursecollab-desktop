"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { QuizPreview } from "@/components/quiz-preview"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { motion } from "framer-motion"

interface PreviewQuizPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewQuizPage({ params }: PreviewQuizPageProps) {
  const { id } = use(params)

  return (
    <AssessmentProvider type="quiz">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full min-w-0"
      >
        <CardWrapper delay={0} hover={false}>
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
            <QuizPreview quizId={id} assessmentType="quiz" embedInDashboard />
          </div>
        </CardWrapper>
      </motion.div>
    </AssessmentProvider>
  )
}
