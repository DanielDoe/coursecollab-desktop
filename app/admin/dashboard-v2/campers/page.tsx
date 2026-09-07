"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { CamperManagement } from "@/components/summer-camp/CamperManagement"
import { cn } from "@/lib/utils"
import { dashboardV2CardBodyClass } from "@/lib/dashboard-v2-layout"

export default function AdminCampersPage() {
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
        <CamperManagement portal="admin" />
      </CardWrapper>
    </motion.div>
  )
}
