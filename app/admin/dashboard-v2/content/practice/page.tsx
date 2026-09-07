"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import InstructorPracticeManagementPage from "@/app/instructor/practice-management/page"

export default function ContentPracticePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 [&_.min-h-screen]:min-h-0 [&_.bg-gradient-to-br]:bg-transparent">
          <InstructorPracticeManagementPage embedInDashboard />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
