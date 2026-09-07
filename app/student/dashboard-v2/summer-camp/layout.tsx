"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { dashboardV2CardBodyClass, dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

/** Same glass card shell as quiz-history, settings, and other dashboard-v2 routes. */
export default function SummerCampDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(dashboardV2PageRootClass, "w-full min-w-0")}
    >
      <CardWrapper delay={0} hover={false} contentClassName={cn(dashboardV2CardBodyClass)}>
        <div data-camper-portal className="min-w-0">
          {children}
        </div>
      </CardWrapper>
    </motion.div>
  )
}
