"use client"

import { Shield } from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PrivacySecurityPanel } from "@/components/compliance/PrivacySecurityPanel"
import { getStudentAuthHeaders, logoutStudent } from "@/lib/auth"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

const settingsTheme = getStudentModuleTheme("settings")

export default function StudentPrivacySettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-8">
      <EmbedModuleCard>
        <div className="space-y-5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                settingsTheme.page.iconBg,
                settingsTheme.page.iconText,
              )}
            >
              <Shield className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-[var(--cc-text)]">Privacy &amp; Security</h1>
              <p className="text-sm text-[var(--cc-text-muted)]">
                Policy, Cora data, and account deletion
              </p>
            </div>
          </div>
          <PrivacySecurityPanel
            accountKind="student"
            authHeaders={getStudentAuthHeaders()}
            onDeleted={() => logoutStudent(true)}
          />
        </div>
      </EmbedModuleCard>
    </motion.div>
  )
}
