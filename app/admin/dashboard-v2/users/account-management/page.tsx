"use client"

import { motion } from "framer-motion"
import { AdminAccountManagement } from "@/components/admin/AdminAccountManagement"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function AccountManagementPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={dashboardV2PageRootClass}
    >
      <AdminAccountManagement />
    </motion.div>
  )
}
