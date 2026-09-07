"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { History, Palette, Receipt, Shield, User } from "lucide-react"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import {
  SETTINGS_HUB_BASE,
  resolveSettingsBrowseId,
  type SettingsBrowseId,
} from "@/components/student/dashboard-v2/SettingsBrowseNav"
import { getStudentData } from "@/lib/auth"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { THEME_DEFINITIONS } from "@/lib/appearance/app-themes"

export function SettingsBrowseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const activeId = resolveSettingsBrowseId(pathname)
  const { themeId, appearanceMode, isDark } = useAppearance()
  const themeName = THEME_DEFINITIONS.find((t) => t.id === themeId)?.name ?? "Default"
  const appearanceLabel =
    appearanceMode === "system" ? "System" : isDark ? "Dark" : "Light"

  const [studentName, setStudentName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    const student = getStudentData()
    setStudentName(student?.name?.trim() || "")
    setEmail(student?.email?.trim() || "")
  }, [])

  const onMenuSelect = (id: string) => {
    const map: Record<SettingsBrowseId, string> = {
      account: SETTINGS_HUB_BASE,
      appearance: `${SETTINGS_HUB_BASE}/appearance`,
      purchases: `${SETTINGS_HUB_BASE}/purchases`,
      privacy: `${SETTINGS_HUB_BASE}/privacy`,
      "cora-usage": `${SETTINGS_HUB_BASE}/cora-usage`,
    }
    router.push(map[id as SettingsBrowseId] ?? SETTINGS_HUB_BASE)
  }

  const metaLine =
    studentName && email
      ? `${studentName} · ${email}`
      : studentName
        ? studentName
        : "Account, security, and preferences"

  return (
    <StudentModuleHubLayout
      moduleId="settings"
      title="Settings"
      metaLine={metaLine}
      metaSuffix="profile, security, and app preferences"
      menuView={activeId}
      onMenuSelect={onMenuSelect}
      menuItems={[
        { id: "account", label: "Account", icon: User },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "purchases", label: "Purchases", icon: Receipt },
        { id: "privacy", label: "Privacy", icon: Shield },
        { id: "cora-usage", label: "Cora usage", icon: History },
      ]}
    >
      {activeId === "appearance" ? (
        <p className="mb-3 text-xs text-[var(--cc-text-muted)]">
          {themeName} · {appearanceLabel}
        </p>
      ) : null}
      {children}
    </StudentModuleHubLayout>
  )
}
