"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { AppearanceSettingsPanel } from "@/components/appearance/AppearanceSettingsPanel"

export default function AppearanceSettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-4">
      <AppearanceSettingsPanel />
    </motion.div>
  )
}
