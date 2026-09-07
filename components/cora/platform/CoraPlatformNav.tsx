"use client"

import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { CORA_PLATFORM_NAV, type CoraPlatformTab } from "@/lib/cora/platform-nav"
import type { CoraChrome } from "@/lib/cora/cora-chrome-theme"
import { cn } from "@/lib/utils"

type Props = {
  activeTab: CoraPlatformTab
  onNavigate: (tab: CoraPlatformTab) => void
  chrome: CoraChrome
  className?: string
}

export function CoraPlatformNav({ activeTab, onNavigate, chrome, className }: Props) {
  return (
    <FacultyModuleSideMenu
      embedded
      moduleId="ai-tutor"
      className={cn(
        "@[720px]/cora-hub:border-r @[720px]/cora-hub:border-[var(--border)] @[720px]/cora-hub:pr-4",
        className,
      )}
      accent={{ soft: chrome.soft, ink: chrome.ink }}
      title="Browse"
      activeId={activeTab}
      onSelect={(id) => onNavigate(id as CoraPlatformTab)}
      items={CORA_PLATFORM_NAV.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
      }))}
    />
  )
}
