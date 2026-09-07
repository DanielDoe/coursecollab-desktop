"use client"

import { motion } from "framer-motion"
import { CreateQuestionForm } from "@/components/create-question-form"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { ADMIN_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

export default function V2NewQuestionBankPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <CreateQuestionForm
            userType="admin"
            bankListPath={ADMIN_V2_QUESTION_BANK_PATH}
            embedInDashboard
          />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
