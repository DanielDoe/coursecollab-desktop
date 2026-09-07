"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { StudentNotificationsPanel } from "@/components/student/student-notifications-panel"

export default function DashboardV2InboxPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <StudentNotificationsPanel />
    </motion.div>
  )
}
