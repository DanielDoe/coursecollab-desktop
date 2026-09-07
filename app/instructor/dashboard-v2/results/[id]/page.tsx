"use client"

import { use } from "react"
import { motion } from "framer-motion"
import { QuizResults } from "@/components/quiz-results"

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
      className="w-full min-w-0 overflow-x-hidden"
    >
      <QuizResults attemptId={id} isAdminView userType="instructor" embedInDashboard />
    </motion.div>
  )
}
