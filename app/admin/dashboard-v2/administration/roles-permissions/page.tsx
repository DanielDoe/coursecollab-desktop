"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { AdminRolesPermissionsHub } from "@/components/admin/AdminRolesPermissionsHub"

export default function RolesPermissionsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full min-w-0"
    >
      <AdminRolesPermissionsHub />
    </motion.div>
  )
}
