"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { InstructorAssessmentDeletedView } from "@/components/instructor/dashboard-v2/InstructorAssessmentDeletedView"

export default function AssessmentsQuizzesDeletedPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <InstructorAssessmentDeletedView
            assessmentType="quiz"
            assessmentLabel="Quiz"
            assessmentPluralLabel="Quizzes"
          />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
