"use client"

import { motion } from "framer-motion"
import {
  setInstructorBannerDismissed,
  setInstructorDashboardVersion,
  shouldShowInstructorBanner,
} from "@/lib/instructor-dashboard-version"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { X, LayoutDashboard, BarChart3, ClipboardList, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InstructorDashboard2Banner() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(shouldShowInstructorBanner())
  }, [])

  const handleSwitch = () => {
    setInstructorDashboardVersion("v2")
    router.push(FACULTY_DASHBOARD_BASE)
  }

  const handleDismiss = () => {
    setInstructorBannerDismissed(true)
    setVisible(false)
  }

  if (!visible) return null

  const features = [
    { icon: LayoutDashboard, label: "Cleaner layout" },
    { icon: BarChart3, label: "Richer analytics" },
    { icon: ClipboardList, label: "Quick module access" },
    { icon: Zap, label: "Faster navigation" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl mb-6 border border-slate-200/80 dark:border-slate-700/50 bg-emerald-50/40 dark:bg-slate-900/70 shadow-sm"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/5 to-transparent" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-10 h-8 w-8 rounded-lg opacity-60 hover:opacity-100 text-slate-500 dark:text-slate-400"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5 p-5 pr-12">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Try Faculty Dashboard 2.0 – Redesigned for you
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            A streamlined layout, grouped navigation, quick actions, and faster access to quizzes, results, and students.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              >
                <Icon className="h-3.5 w-3.5 text-emerald-600/70 dark:text-emerald-400/70" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSwitch}
          className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-sm"
        >
          Switch to 2.0
        </Button>
      </div>
    </motion.div>
  )
}
