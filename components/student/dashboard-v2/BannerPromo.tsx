"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CardWrapper } from "./CardWrapper"
import { useDashboardV2 } from "./DashboardV2Context"

/** Performance Command Center intro card on the dashboard home. */
export function BannerPromo() {
  const { welcomeCardDismissed } = useDashboardV2()

  if (welcomeCardDismissed) return null

  return (
    <motion.div
      data-tour="pcc"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <CardWrapper delay={0} hover={true}>
        <div className="p-6 md:p-8">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              Performance Command Center
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
              Track grades, attendance, and academic progress at a glance.
            </p>
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
