"use client"

import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { cn } from "@/lib/utils"

type ShellSidebarHeaderProps = {
  collapsed: boolean
  homeHref: string
}

export function ShellSidebarHeader({ collapsed, homeHref }: ShellSidebarHeaderProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex shrink-0 items-center gap-0.5 border-b border-[#EBEBEB] bg-white px-3 pb-2 pt-3.5 dark:border-[#262626] dark:bg-[#111111]",
        collapsed && "flex-col justify-center px-2",
      )}
    >
      {!collapsed ? (
        <Link
          href={homeHref}
          className="flex min-w-0 flex-1 items-center gap-2 py-1"
        >
          <CourseCollabLogo
            height={24}
            tone="primary"
            withWordmark
            frameClassName="rounded-md"
            className="min-w-0"
            wordmarkClassName="truncate text-[17px] font-bold leading-none tracking-[-0.02em] text-[#1A1A1A] dark:text-white"
          />
        </Link>
      ) : (
        <Link
          href={homeHref}
          className="mb-1 flex size-9 items-center justify-center"
          aria-label="CourseCollab home"
        >
          <CourseCollabLogo height={26} tone="primary" frameClassName="rounded-md" />
        </Link>
      )}
    </div>
  )
}
