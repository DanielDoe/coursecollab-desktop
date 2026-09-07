"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { InstructorTradeCenterOverview } from "@/components/instructor-trade-center-overview"
import { InstructorTradeCenterConfig } from "@/components/instructor-trade-center-config"
import { InstructorTradeCenterAnalytics } from "@/components/instructor-trade-center-analytics"
import { InstructorTradeCenterDonations } from "@/components/instructor-trade-center-donations"
import { InstructorTradeCenterActivitySettings } from "@/components/instructor-trade-center-activity-settings"
import { InstructorTradeCenterRolloverTrades } from "@/components/instructor-trade-center-rollover-trades"
import { InstructorTradeCenterTradeLog } from "@/components/instructor-trade-center-trade-log"
import { getAdminData } from "@/lib/auth"
import { BarChart3, Settings, Gift, Users, RotateCw, History } from "lucide-react"
import { cn } from "@/lib/utils"

type MenuTab = "overview" | "config" | "analytics" | "donations" | "trade-log" | "rollover-trades" | "activity-settings"

const MENU_ITEMS: { id: MenuTab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "config", label: "Conversion Rules", icon: Settings },
  { id: "analytics", label: "Student Analytics", icon: BarChart3 },
  { id: "donations", label: "Donations", icon: Gift },
  { id: "trade-log", label: "Trade log", icon: History },
  { id: "rollover-trades", label: "Rollover Trades", icon: RotateCw },
  { id: "activity-settings", label: "Activity Settings", icon: Users },
]

export default function StudentsTradeCenterPage() {
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState<MenuTab>("overview")

  useEffect(() => {
    const instructor = getAdminData()
    if (!instructor?.id) return
    setInstructorId(parseInt(instructor.id.toString(), 10))
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!instructorId) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="pb-4 mb-4 border-b border-slate-200/70 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Trade Center</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Engagement credits, trades, donations, and roster analytics for this course.
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="w-full lg:w-56 shrink-0">
              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.08]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Trade Center
                  </p>
                </div>
                <div className="p-1.5">
                  {MENU_ITEMS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeMenu === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveMenu(id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-teal-500/15 dark:bg-teal-500/25 text-teal-700 dark:text-teal-300 font-medium"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-x-hidden">
              {activeMenu === "overview" && <InstructorTradeCenterOverview instructorId={instructorId} />}
              {activeMenu === "config" && <InstructorTradeCenterConfig />}
              {activeMenu === "analytics" && <InstructorTradeCenterAnalytics instructorId={instructorId} />}
              {activeMenu === "donations" && <InstructorTradeCenterDonations instructorId={instructorId} />}
              {activeMenu === "trade-log" && <InstructorTradeCenterTradeLog instructorId={instructorId} />}
              {activeMenu === "rollover-trades" && (
                <InstructorTradeCenterRolloverTrades instructorId={instructorId} />
              )}
              {activeMenu === "activity-settings" && <InstructorTradeCenterActivitySettings />}
            </div>
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
