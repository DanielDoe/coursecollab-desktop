"use client"

import { motion } from "framer-motion"
import { AssessmentProvider } from "@/context/assessment-context"
import { InstructorQuizIssues } from "@/components/instructor-quiz-issues"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

export default function AssessmentsQuizzesIssuesPage() {
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
            <InstructorQuizIssues assessmentType="quiz" />
          </div>
        </CardWrapper>
      </motion.div>
    </AssessmentProvider>
  )
}
