"use client"

import { motion } from "framer-motion"
import { InstructorOfficeHoursPanel } from "@/components/instructor/office-hours/instructor-office-hours-panel"

export default function LearningCenterOfficeHoursPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      <InstructorOfficeHoursPanel embedInDashboard />
    </motion.div>
  )
}
