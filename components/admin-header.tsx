"use client"

import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { AdminProfileDropdown } from "./admin-profile-dropdown"
import { AdminNotificationBell } from "./admin-notification-bell"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

export function AdminHeader() {
  const homeLink = useSmartHomeLink()

  return (
    <header className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href={homeLink} className="flex items-center hover:opacity-80 transition-opacity">
            <CourseCollabLogo size="md" tone="indigo" withWordmark />
          </Link>
          <div className="flex items-center gap-4">
            <AdminNotificationBell />
            <AdminProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}
