"use client"

import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { StudentProfileDropdown } from "./student-profile-dropdown"
import { NotificationBell } from "./notification-bell"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

export function StudentHeader() {
  const homeLink = useSmartHomeLink()

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/85 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-[var(--card)]/70">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href={homeLink} className="flex items-center hover:opacity-80 transition-opacity">
            <CourseCollabLogo size="md" tone="theme" withWordmark />
          </Link>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <StudentProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}
