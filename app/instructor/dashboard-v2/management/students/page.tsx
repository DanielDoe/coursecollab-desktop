"use client"

import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { StudentManagement } from "@/components/student-management"

export default function ManagementStudentsPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "account-requests" ? "account-requests" : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      <StudentManagement userType="instructor" embedInDashboard initialTab={initialTab} />
    </motion.div>
  )
}
