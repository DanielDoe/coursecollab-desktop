"use client"

import { useMemo, useState } from "react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Code2,
  Copy,
  FilePenLine,
  FileText,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  MoreVertical,
  PanelLeft,
  Search,
  Settings,
  Sun,
  User,
  UsersRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DrawerNavItem } from "@/components/dashboard-v2/DrawerNavItem"

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  locked?: boolean
  badge?: string
  shortcut?: string
}

type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    items: [
      { id: "search", label: "Search", icon: Search, shortcut: "⌘K" },
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "learning-center",
    label: "Learning",
    items: [
      { id: "lectures", label: "Lectures", icon: BookOpen },
      { id: "notes", label: "My Notes", icon: FilePenLine },
      { id: "flashcards", label: "Flashcards", icon: Layers },
      { id: "ai-notetaker", label: "AI Notetaker", icon: Mic, locked: true },
      { id: "practice", label: "Practice Hub", icon: Lightbulb, locked: true },
      { id: "codebench", label: "CodeBench", icon: Code2 },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    items: [
      { id: "quizzes", label: "Quizzes", icon: ClipboardList, badge: "3" },
      { id: "history", label: "History", icon: History },
      { id: "homework", label: "Homework", icon: FileText },
      { id: "mid-semester", label: "Mid-Semester", icon: GraduationCap },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    items: [
      { id: "forum", label: "Forum Hub", icon: MessageSquare },
      { id: "messages", label: "Messages", icon: Mail },
      { id: "groups", label: "Groups", icon: UsersRound },
      { id: "calendar", label: "Calendar", icon: Calendar },
    ],
  },
]

const PAGE_TABS: Record<string, string[]> = {
  dashboard: ["Overview", "Upcoming", "Grades", "Activity"],
  lectures: ["All lectures", "In progress", "Completed", "Notes"],
  quizzes: ["Open", "History", "Practice", "Insights"],
}

function NavButton({
  item,
  active,
  collapsed,
  onSelect,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onSelect: () => void
}) {
  return (
    <DrawerNavItem
      label={item.label}
      isActive={active}
      collapsed={collapsed}
      onClick={onSelect}
      icon={item.icon}
      compact
      trailing={
        <>
          {item.locked ? (
            <Lock className="size-3 shrink-0 text-[var(--cc-drawer-label-secondary)]" strokeWidth={2.25} />
          ) : null}
          {item.badge ? (
            <span className="rounded bg-[var(--cc-drawer-icon-well-bg,#e5e7eb)] px-1.5 text-[11px] font-medium text-[var(--cc-drawer-label-secondary)]">
              {item.badge}
            </span>
          ) : null}
          {item.shortcut ? (
            <kbd className="rounded border border-[var(--cc-drawer-soft-border,#e5e7eb)] bg-[var(--cc-drawer-nav-idle-bg,#fff)] px-1.5 py-0.5 text-[10px] text-[var(--cc-drawer-label-secondary)]">
              {item.shortcut}
            </kbd>
          ) : null}
        </>
      }
    />
  )
}

export function DesktopNativeChromePreview() {
  const [activeId, setActiveId] = useState("dashboard")
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState("Overview")
  const [profileOpen, setProfileOpen] = useState(false)

  const activeLabel = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const match = group.items.find((item) => item.id === activeId)
      if (match) return match.label
    }
    return "Dashboard"
  }, [activeId])

  const tabs = PAGE_TABS[activeId] ?? PAGE_TABS.dashboard

  return (
    <div className="min-h-[100dvh] bg-[#e5e7eb] p-4 text-[#111827] sm:p-6">
      <style>{`
        .cc-langsmith-preview {
          font-family: Inter, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
        }
      `}</style>

      <div className="mx-auto mb-4 max-w-[1320px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Standalone experiment</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">LangSmith-style desktop chrome</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#6b7280]">
          Preview only. Sidebar is a source list with a project switcher, left-edge active bar, and footer profile. The
          header is a quiet content toolbar with breadcrumbs, page title, and tabs.
        </p>
      </div>

      <div
        className="cc-langsmith-preview mx-auto flex h-[860px] max-w-[1320px] overflow-hidden rounded-[10px] border border-[#d1d5db] bg-white"
        onClick={() => {
          if (profileOpen) setProfileOpen(false)
        }}
      >
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-[#e5e7eb] bg-white transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-[248px]",
          )}
        >
          <div className={cn("flex items-center gap-1 border-b border-[#e5e7eb] px-2 py-2", collapsed && "justify-center")}>
            {!collapsed ? (
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-left hover:bg-[#f3f4f6]"
                aria-label="CourseCollab"
              >
                <CourseCollabLogo
                  height={22}
                  tone="primary"
                  withWordmark
                  frameClassName="rounded-md"
                  className="min-w-0"
                  wordmarkClassName="truncate text-[13px] font-semibold leading-none tracking-tight"
                />
                <ChevronDown className="size-3.5 shrink-0 text-[#9ca3af]" />
              </button>
            ) : (
              <CourseCollabLogo height={28} tone="primary" frameClassName="rounded-md" />
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex size-8 items-center justify-center rounded-[6px] text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-4" />
            </button>
          </div>

          <nav className={cn("min-h-0 flex-1 overflow-y-auto px-2 py-3", collapsed && "px-1.5")}>
            {NAV_GROUPS.map((group, index) => (
              <div key={group.id} className={cn(index > 0 && "mt-3")}>
                {index > 0 ? <div className="mb-2 border-t border-[#e5e7eb]" /> : null}
                {group.label && !collapsed ? (
                  <p className="px-2.5 pb-1.5 text-[11px] font-medium text-[#9ca3af]">{group.label}</p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavButton
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      collapsed={collapsed}
                      onSelect={() => {
                        setActiveId(item.id)
                        setActiveTab((PAGE_TABS[item.id] ?? PAGE_TABS.dashboard)[0])
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[#e5e7eb] p-2">
            <NavButton
              item={{ id: "settings", label: "Settings", icon: Settings }}
              active={activeId === "settings"}
              collapsed={collapsed}
              onSelect={() => setActiveId("settings")}
            />
            <button
              type="button"
              className={cn(
                "mt-1 flex w-full items-center rounded-[6px] hover:bg-[#f3f4f6]",
                collapsed ? "h-10 justify-center" : "gap-2.5 px-2 py-2",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-[#582c83] text-[11px] font-semibold text-white">
                D
              </span>
              {!collapsed ? (
                <span className="min-w-0 text-left">
                  <span className="block truncate text-[12px] font-medium leading-none">Daniel Doe</span>
                  <span className="mt-1 block truncate text-[11px] leading-none text-[#6b7280]">dmdoep01@pvamu.edu</span>
                </span>
              ) : null}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="border-b border-[#e5e7eb]">
            <div className="flex items-center justify-between gap-3 px-5 pt-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
                <span>ELEG1301</span>
                <ChevronRight className="size-3" />
                <span>{activeLabel}</span>
                <ChevronRight className="size-3" />
                <span className="text-[#111827]">{activeTab}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-[#e5e7eb] px-2 py-1 text-[11px] text-[#6b7280]">
                  Scholar
                </span>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e7eb] px-2.5 text-[12px] text-[#374151] hover:bg-[#f9fafb]">
                  Dashboard
                </button>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="More">
                  <MoreVertical className="size-4" />
                </button>
                <button type="button" className="relative inline-flex size-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Notifications">
                  <Bell className="size-4" />
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef4444]" />
                </button>
                <button type="button" className="inline-flex h-8 items-center rounded-full bg-[#2563eb] px-3 text-[12px] font-medium text-white">
                  + New
                </button>
                <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    onClick={() => setProfileOpen((open) => !open)}
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-1.5 pr-2 hover:bg-[#f9fafb]"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-[#582c83] text-[10px] font-semibold text-white">
                      DD
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block text-[12px] font-medium leading-none">Daniel Doe</span>
                    </span>
                    <ChevronDown className="size-3.5 text-[#9ca3af]" />
                  </button>
                  {profileOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white"
                    >
                      <div className="border-b border-[#e5e7eb] px-3 py-2.5">
                        <p className="text-[13px] font-medium">Daniel Doe</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#6b7280]">dmdoep01@pvamu.edu</p>
                      </div>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#f3f4f6]">
                        <User className="size-3.5" />
                        Profile
                      </button>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#f3f4f6]">
                        <Settings className="size-3.5" />
                        Settings
                      </button>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#f3f4f6]">
                        <Sun className="size-3.5" />
                        Appearance
                      </button>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 border-t border-[#e5e7eb] px-3 py-2 text-left text-[13px] text-[#b91c1c] hover:bg-[#fef2f2]">
                        <LogOut className="size-3.5" />
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 px-5 pt-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[22px] font-semibold tracking-tight">{activeLabel}</h2>
                  <span className="rounded border border-[#e5e7eb] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280]">
                    ID
                  </span>
                  <Copy className="size-3.5 text-[#9ca3af]" />
                </div>
                <div className="mt-3 flex items-center gap-5">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "border-b-2 pb-2 text-[13px]",
                        activeTab === tab
                          ? "border-[#111827] font-medium text-[#111827]"
                          : "border-transparent text-[#6b7280] hover:text-[#111827]",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto bg-[#f9fafb] p-5">
            <div className="mb-4 flex items-center justify-between rounded-[8px] border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1d4ed8]">
              <span>21 pending items across quizzes, homework, and announcements.</span>
              <button type="button" className="font-medium underline underline-offset-2">
                View all
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Current average", "91%"],
                ["Attendance", "96%"],
                ["Missing work", "2"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-3">
                  <p className="text-[12px] text-[#6b7280]">{label}</p>
                  <p className="mt-1 text-[22px] font-semibold tracking-tight">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[8px] border border-[#e5e7eb] bg-white p-4">
              <p className="text-[13px] font-medium">Quick start</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
                This chrome follows the LangSmith pattern: workspace switcher in the sidebar, quiet grouped nav, a
                content header with breadcrumbs and underline tabs, and utility actions on the right. Collapse keeps a
                72px icon rail.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
