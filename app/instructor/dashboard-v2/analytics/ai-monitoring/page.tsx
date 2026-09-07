"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { InstructorAIMonitoringDashboard } from "@/components/instructor-ai-monitoring-dashboard"

export default function AIMonitoringPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6">
          <InstructorAIMonitoringDashboard embedInDashboard />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
