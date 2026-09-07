"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { cn } from "@/lib/utils"

type QuizTakerChromeProps = {
  title?: string
  toolbar?: ReactNode
}

/** Compact sticky chrome for immersive quiz / exam takers — no dashboard sidebar padding. */
export function QuizTakerChrome({ title, toolbar }: QuizTakerChromeProps) {
  const homeLink = useSmartHomeLink()

  return (
    <div
      data-quiz-chrome
      className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--card)]/85"
    >
      {title ? (
        <div className="flex h-12 items-center gap-3 px-4 sm:h-14 sm:px-5">
          <Link href={homeLink} className="shrink-0 transition-opacity hover:opacity-80">
            <CourseCollabLogo size="sm" tone="theme" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--cc-text)] sm:text-base">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
            <StudentProfileDropdown />
          </div>
        </div>
      ) : null}
      {toolbar ? (
        <div className={cn(title && "border-t border-[var(--border)]", "bg-[var(--cc-background)]/90")}>
          {toolbar}
        </div>
      ) : null}
    </div>
  )
}
