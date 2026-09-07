"use client"

import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GraduationCap, BarChart3, Users, AlertTriangle, Settings, ArrowLeft, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { InstructorGradesOverview } from "@/components/instructor-grades-overview"
import { InstructorGradesManage } from "@/components/instructor-grades-manage"
import { InstructorGradesAnalytics } from "@/components/instructor-grades-analytics"
import { InstructorGradesFlagged } from "@/components/instructor-grades-flagged"
import { InstructorGradesSettings } from "@/components/instructor-grades-settings"
import { getInstructorData } from "@/lib/auth"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"

type MenuTab = "overview" | "manage" | "analytics" | "flagged" | "settings"

const menuItems = [
  { id: "overview" as MenuTab, label: "Overview", icon: BarChart3, description: "View overall class performance" },
  { id: "manage" as MenuTab, label: "Manage", icon: Users, description: "Manage student grades" },
  { id: "analytics" as MenuTab, label: "Analytics", icon: BarChart3, description: "Grade analytics and insights" },
  { id: "flagged" as MenuTab, label: "Flagged", icon: AlertTriangle, description: "At-risk students" },
  { id: "settings" as MenuTab, label: "Settings", icon: Settings, description: "Grade weight configurations" },
]

export function InstructorGradesContent({ embedInDashboard = false }: { embedInDashboard?: boolean }) {
  const fp = getFacultyModuleTheme("grades").page
  const cardBase = PORTAL_CARD
  const router = useRouter()
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState<MenuTab>("overview")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const instructor = getInstructorData()
    if (!instructor?.id) {
      router.push("/faculty/login")
      return
    }
    setInstructorId(parseInt(String(instructor.id), 10))
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedInDashboard ? "min-h-[280px]" : "min-h-[60vh]"}`}>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading grades module…</p>
        </div>
      </div>
    )
  }

  const handleRefresh = () => setRefreshKey((prev) => prev + 1)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!embedInDashboard && (
          <div className="flex items-center gap-4">
            <div className={cn("rounded-xl p-3 shadow-lg", fp.iconBg)}>
              <GraduationCap className={cn("h-6 w-6", fp.iconText)} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">
                Grades Management
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Manage student grades, analytics, and grade configurations
              </p>
            </div>
          </div>
        )}
        <div className={`flex items-center gap-2 ${embedInDashboard ? "justify-end" : ""}`}>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 rounded-lg">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {!embedInDashboard && (
            <Button onClick={() => router.push(FACULTY_DASHBOARD_BASE)} variant="outline" size="sm" className="gap-2 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>

      <FacultyModuleSplitLayout
        menu={
          <FacultyModuleSideMenu
            moduleId="grades"
            title="Grades"
            activeId={activeMenu}
            onSelect={(id) => setActiveMenu(id as MenuTab)}
            items={menuItems.map(({ id, label, icon }) => ({ id, label, icon }))}
          />
        }
      >
        <motion.div
          key={refreshKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="min-w-0 space-y-4"
        >
          {activeMenu === "overview" && <InstructorGradesOverview instructorId={instructorId!} session="ALL" />}
          {activeMenu === "manage" && <InstructorGradesManage instructorId={instructorId!} session="ALL" />}
          {activeMenu === "analytics" && <InstructorGradesAnalytics instructorId={instructorId!} session="ALL" dataRefreshKey={refreshKey} />}
          {activeMenu === "flagged" && <InstructorGradesFlagged instructorId={instructorId!} session="ALL" />}
          {activeMenu === "settings" && <InstructorGradesSettings instructorId={instructorId!} session="ALL" />}
        </motion.div>
      </FacultyModuleSplitLayout>
    </div>
  )
}
