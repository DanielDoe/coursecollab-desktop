"use client"

import { motion } from "framer-motion"
import { InstructorOfficeHoursPanel } from "@/components/instructor/office-hours/instructor-office-hours-panel"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function LearningCenterOfficeHoursPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <InstructorOfficeHoursPanel embedInDashboard />
      </motion.div>
    </StudentDashboardModulePage>
  )
}
