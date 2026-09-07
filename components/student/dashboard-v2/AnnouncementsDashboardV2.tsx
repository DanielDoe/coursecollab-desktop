"use client"

import { useCallback, useMemo, useState } from "react"
import { Inbox, Megaphone, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AnnouncementsFeedRedesign } from "@/components/announcements-feed-redesign"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"

type MenuView = "all" | "unread"

type HubMeta = {
  total: number
  filtered: number
  unread: number
  loading: boolean
}

type Props = {
  studentId: string
  initialOpenId?: number | null
}

export function AnnouncementsDashboardV2({ studentId, initialOpenId = null }: Props) {
  const desktopChrome = isDesktopAppShell()
  const [menuView, setMenuView] = useState<MenuView>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [hubMeta, setHubMeta] = useState<HubMeta>({
    total: 0,
    filtered: 0,
    unread: 0,
    loading: true,
  })

  const handleHubMetaChange = useCallback((meta: HubMeta) => {
    setHubMeta(meta)
  }, [])

  const metaLine = useMemo(() => {
    if (hubMeta.loading) {
      return "Loading announcements…"
    }
    const parts = [`${hubMeta.filtered} shown`]
    if (hubMeta.unread > 0) parts.push(`${hubMeta.unread} unread`)
    if (menuView === "unread") parts.push("unread only")
    return parts.join(" · ")
  }, [hubMeta, menuView])

  const toolbar = (
    <div className="relative h-10 min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
      <Input
        placeholder="Search announcements…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={cn(
          "h-10 w-full pl-10 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
          desktopChrome
            ? "rounded-full border-0 bg-[var(--sidebar-accent)]/50 focus-visible:bg-[var(--sidebar-accent)]/70"
            : "rounded-xl border border-[var(--border)] bg-[var(--muted)]/40",
        )}
      />
    </div>
  )

  return (
    <StudentModuleHubLayout
      moduleId="announcements"
      title="Announcements"
      metaLine={metaLine}
      metaSuffix="course updates from your instructors"
      toolbar={toolbar}
      menuView={menuView}
      onMenuSelect={(id) => setMenuView(id as MenuView)}
      menuItems={[
        { id: "all", label: "All posts", icon: Megaphone, badge: hubMeta.total > 0 ? hubMeta.total : undefined },
        {
          id: "unread",
          label: "Unread",
          icon: Inbox,
          badge: hubMeta.unread > 0 ? hubMeta.unread : undefined,
        },
      ]}
    >
      <AnnouncementsFeedRedesign
        studentId={studentId}
        embedInDashboard
        hubLayout
        initialOpenId={initialOpenId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        showUnreadOnly={menuView === "unread"}
        onHubMetaChange={handleHubMetaChange}
      />
    </StudentModuleHubLayout>
  )
}
