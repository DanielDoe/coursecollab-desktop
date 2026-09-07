"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { EditQuizForm } from "@/components/edit-quiz-form"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { motion } from "framer-motion"

interface EditQuizPageProps {
  params: Promise<{ id: string }>
}

export default function EditQuizPage({ params }: EditQuizPageProps) {
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
            <EditQuizForm quizId={id} assessmentType="quiz" embedInDashboard />
          </div>
        </CardWrapper>
      </motion.div>
    </AssessmentProvider>
  )
}
