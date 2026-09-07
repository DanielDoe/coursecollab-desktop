"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { InstructorAIInsights } from "@/components/instructor-ai-insights"

export default function AIInsightsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full min-w-0 pb-8"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6">
          <InstructorAIInsights embedInDashboard />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
