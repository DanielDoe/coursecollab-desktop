"use client"

import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FACULTY_CORA_PLATFORM_NAV,
  type FacultyCoraPlatformTab,
} from "@/lib/cora/faculty-platform-nav"
import type { CoraChrome } from "@/lib/cora/cora-chrome-theme"
import { cn } from "@/lib/utils"

type Props = {
  activeTab: FacultyCoraPlatformTab
  onNavigate: (tab: FacultyCoraPlatformTab) => void
  chrome: CoraChrome
  className?: string
}

export function FacultyCoraPlatformNav({ activeTab, onNavigate, chrome, className }: Props) {
  return (
    <FacultyModuleSideMenu
      embedded
      moduleId="cora-copilot"
      className={cn("lg:border-r lg:border-[var(--border)] lg:pr-4", className)}
      accent={{ soft: chrome.soft, ink: chrome.ink }}
      title="Browse"
      activeId={activeTab}
      onSelect={(id) => onNavigate(id as FacultyCoraPlatformTab)}
      items={FACULTY_CORA_PLATFORM_NAV.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
      }))}
    />
  )
}
