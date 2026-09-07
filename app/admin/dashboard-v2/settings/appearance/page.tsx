"use client"

import { motion } from "framer-motion"
import { Palette } from "lucide-react"
import { AppearanceSettingsPanel } from "@/components/appearance/AppearanceSettingsPanel"
import { getFacultyNavGroupTheme } from "@/lib/faculty-module-themes"
import { cn } from "@/lib/utils"

const settingsTheme = getFacultyNavGroupTheme("settings")

export default function AdminAppearanceSettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-8 space-y-6">
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-[var(--card)] shadow-sm",
          settingsTheme.page.border,
        )}
      >
        <header className="border-b border-[var(--border)] px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                settingsTheme.page.iconBg,
                settingsTheme.page.iconText,
              )}
            >
              <Palette className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-[var(--cc-text)]">Appearance & themes</h1>
              <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                Same themes as student, faculty, and mobile. Changes apply instantly across the admin dashboard.
              </p>
            </div>
          </div>
        </header>
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <AppearanceSettingsPanel />
        </div>
      </div>
    </motion.div>
  )
}
