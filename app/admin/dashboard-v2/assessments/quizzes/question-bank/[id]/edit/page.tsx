"use client"

import { use } from "react"
import { motion } from "framer-motion"
import { EditQuestionForm } from "@/components/edit-question-form"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { ADMIN_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

export default function V2EditQuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <EditQuestionForm
            questionId={id}
            userType="admin"
            bankListPath={ADMIN_V2_QUESTION_BANK_PATH}
            embedInDashboard
          />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
