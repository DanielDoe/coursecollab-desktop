"use client"

import { use } from "react"
import { motion } from "framer-motion"
import { QuizResults } from "@/components/quiz-results"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

export default function InstructorDashboardV2ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-x-hidden"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <QuizResults
            attemptId={id}
            isAdminView={true}
            userType="admin"
            embedInDashboard
          />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
