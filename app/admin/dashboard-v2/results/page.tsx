"use client"

import { motion } from "framer-motion"
import { ResultsViewer } from "@/components/results-viewer"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

export default function InstructorDashboardV2ResultsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-x-hidden"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <ResultsViewer userType="admin" embedInDashboard />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
