"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Sparkles, TrendingUp, Lightbulb } from "lucide-react"
import { CardWrapper } from "./CardWrapper"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalIconBadgeClass } from "@/lib/portal-module-themes"

const dashboardTheme = getStudentModuleTheme("dashboard")

/** AI Insights panel — solid semantic tints, readable in light and dark mode */
export function AIInsightPanel() {
  const insights = [
    {
      icon: TrendingUp,
      text: "Your quiz scores have improved 12% this week. Keep practicing selection criteria!",
      tile: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Lightbulb,
      text: "You haven't practiced loops this week. Consider a quick session to maintain mastery.",
      tile: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <CardWrapper delay={0.2}>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className={portalIconBadgeClass(dashboardTheme)}>
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Cora Insights
            </h3>
            <p className="text-sm font-medium text-[var(--cc-text)]">What to do next</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {insights.map((insight, i) => {
            const Icon = insight.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 ${insight.tile}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${insight.iconColor}`} />
                <p className="text-sm leading-relaxed text-[var(--cc-text)]">{insight.text}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </CardWrapper>
  )
}
