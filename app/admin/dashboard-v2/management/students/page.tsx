"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { StudentManagement } from "@/components/student-management"
import { cn } from "@/lib/utils"
import { dashboardV2CardBodyClass } from "@/lib/dashboard-v2-layout"

export default function ManagementStudentsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper
        delay={0}
        hover={false}
        contentClassName={cn(dashboardV2CardBodyClass, "p-5 sm:p-6 md:p-7 lg:p-8")}
      >
        <div className="w-full min-w-0 [&_.min-h-screen]:min-h-0 [&_.bg-gradient-to-br]:bg-transparent">
          <StudentManagement userType="admin" embedInDashboard />
        </div>
      </CardWrapper>
    </motion.div>
  )
}
