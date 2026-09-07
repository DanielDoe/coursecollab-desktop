"use client"

import { motion } from "framer-motion"
import { AssessmentProvider } from "@/context/assessment-context"
import { InstructorQuizManagement } from "@/components/instructor-quiz-management"

export default function AssessmentsQuizzesManagePage() {
  return (
    <AssessmentProvider type="quiz">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full min-w-0"
      >
        <InstructorQuizManagement embedInDashboard />
      </motion.div>
    </AssessmentProvider>
  )
}
