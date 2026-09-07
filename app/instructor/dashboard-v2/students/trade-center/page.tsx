"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { InstructorTradeCenterOverview } from "@/components/instructor-trade-center-overview"
import { InstructorTradeCenterConfig } from "@/components/instructor-trade-center-config"
import { InstructorTradeCenterAnalytics } from "@/components/instructor-trade-center-analytics"
import { InstructorTradeCenterDonations } from "@/components/instructor-trade-center-donations"
import { InstructorTradeCenterActivitySettings } from "@/components/instructor-trade-center-activity-settings"
import { InstructorTradeCenterRolloverTrades } from "@/components/instructor-trade-center-rollover-trades"
import { InstructorTradeCenterTradeLog } from "@/components/instructor-trade-center-trade-log"
import { InstructorMembershipDisclaimerBanner } from "@/components/governance/InstructorMembershipDisclaimerBanner"
import { getInstructorData } from "@/lib/auth"
import { BarChart3, Settings, Gift, Users, RotateCw, History } from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { TC_SPINNER } from "@/lib/trade-center/trade-center-instructor-ui"
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
    const instructor = getInstructorData()
    if (!instructor?.id) return
    setInstructorId(parseInt(instructor.id.toString(), 10))
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className={cn("mx-auto h-8 w-8", TC_SPINNER)} />
      </div>
    )
  }

  if (!instructorId) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      <InstructorMembershipDisclaimerBanner />
      <FacultyModuleSplitLayout
        menu={
          <FacultyModuleSideMenu
            moduleId="trade-center"
            title="Trade Center"
            activeId={activeMenu}
            onSelect={(id) => setActiveMenu(id as MenuTab)}
            items={MENU_ITEMS}
          />
        }
      >
        {activeMenu === "overview" && <InstructorTradeCenterOverview instructorId={instructorId} />}
        {activeMenu === "config" && <InstructorTradeCenterConfig />}
        {activeMenu === "analytics" && <InstructorTradeCenterAnalytics instructorId={instructorId} />}
        {activeMenu === "donations" && <InstructorTradeCenterDonations instructorId={instructorId} />}
        {activeMenu === "trade-log" && <InstructorTradeCenterTradeLog instructorId={instructorId} />}
        {activeMenu === "rollover-trades" && (
          <InstructorTradeCenterRolloverTrades instructorId={instructorId} />
        )}
        {activeMenu === "activity-settings" && <InstructorTradeCenterActivitySettings />}
      </FacultyModuleSplitLayout>
    </motion.div>
  )
}
