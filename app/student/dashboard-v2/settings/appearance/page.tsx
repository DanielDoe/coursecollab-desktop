"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { AppearanceSettingsPanel } from "@/components/appearance/AppearanceSettingsPanel"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

const settingsTheme = getStudentModuleTheme("settings")

export default function AppearanceSettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-8 space-y-6">
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-[var(--card)] shadow-sm",
          settingsTheme.page.border,
        )}
      >
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <AppearanceSettingsPanel />
        </div>
      </div>
    </motion.div>
  )
}
