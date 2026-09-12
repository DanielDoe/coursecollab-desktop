"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckForUpdatesButton } from "@/components/dashboard-v2/CheckForUpdatesButton"
import { getAdminData, getInstructorData, getStudentData } from "@/lib/auth"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import {
  formatInstructorSidebarPlanLabel,
  readCachedInstructorMembershipTier,
  syncInstructorMembershipTierCache,
} from "@/lib/faculty-membership-cache"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import { cn } from "@/lib/utils"

type DrawerAccount = {
  name: string
  plan: string
  membershipHref: string
}

type ShellSidebarFooterProps = {
  collapsed: boolean
  userName?: string
  planLabel?: string
  membershipHref?: string
  onMembershipNavigate?: () => void
  className?: string
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function formatDrawerPlanLabel(tier: string | null | undefined): string {
  const clean = (tier ?? "").trim()
  if (!clean) return "Free Plan"
  if (/^pro$/i.test(clean)) return "Pro+ Plan"
  if (/plan$/i.test(clean)) return clean
  return `${clean} Plan`
}

function readDrawerAccount(): DrawerAccount {
  const student = getStudentData()
  if (student) {
    const tier =
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("studentMembershipTier")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("studentMembershipTier")) ||
      "Scholar"
    return {
      name: student.name?.trim() || "Student",
      plan: formatDrawerPlanLabel(tier),
      membershipHref: "/student/dashboard-v2/membership",
    }
  }

  const faculty = getInstructorData()
  if (faculty) {
    const tier = readCachedInstructorMembershipTier()
    return {
      name: faculty.name?.trim() || faculty.username?.trim() || "Faculty",
      plan: tier ? formatInstructorSidebarPlanLabel(tier) : "Loading plan…",
      membershipHref: FACULTY_MEMBERSHIP_HREF,
    }
  }

  const admin = getAdminData()
  if (admin) {
    return {
      name: admin.name?.trim() || admin.username?.trim() || "Admin",
      plan: "Admin",
      membershipHref: "/admin/dashboard-v2",
    }
  }

  return { name: "Guest", plan: "Free Plan", membershipHref: "/auth/welcome" }
}

/** Sidebar footer — avatar, name, plan, and desktop update pill. */
export function ShellSidebarFooter({
  collapsed,
  userName,
  planLabel,
  membershipHref,
  onMembershipNavigate,
  className,
}: ShellSidebarFooterProps) {
  const [account, setAccount] = useState<DrawerAccount>({
    name: userName?.trim() || "Student",
    plan: planLabel ? formatDrawerPlanLabel(planLabel) : "Scholar Plan",
    membershipHref: membershipHref ?? "/student/dashboard-v2/membership",
  })

  useEffect(() => {
    const sync = () => {
      const next = readDrawerAccount()
      setAccount({
        name: userName?.trim() || next.name,
        plan: planLabel ? formatDrawerPlanLabel(planLabel) : next.plan,
        membershipHref: membershipHref ?? next.membershipHref,
      })
    }
    sync()

    const faculty = getInstructorData()
    if (faculty?.id != null && !planLabel) {
      void syncInstructorMembershipTierCache(faculty.id).then(() => sync())
    }

    window.addEventListener(COURSE_SWITCH_EVENT, sync)
    window.addEventListener("student-session-ready", sync)
    window.addEventListener("faculty-session-ready", sync)
    window.addEventListener("instructor-membership-synced", sync)
    return () => {
      window.removeEventListener(COURSE_SWITCH_EVENT, sync)
      window.removeEventListener("student-session-ready", sync)
      window.removeEventListener("faculty-session-ready", sync)
      window.removeEventListener("instructor-membership-synced", sync)
    }
  }, [membershipHref, planLabel, userName])

  const initials = initialsFromName(account.name)
  const profileLabel = `${account.name}, ${account.plan}`

  if (collapsed) {
    return (
      <div className={cn("mt-auto shrink-0 border-t border-[#EBEBEB] px-1 pb-2 pt-3 dark:border-[#262626]", className)}>
        <div className="flex flex-col items-center gap-2">
          <Link
            href={account.membershipHref}
            onClick={onMembershipNavigate}
            className="flex size-9 items-center justify-center rounded-full bg-[#E8E8E8] text-[11px] font-semibold text-[#4A4A4A] dark:bg-[#2A2A2A] dark:text-[#C8C8C8]"
            aria-label={profileLabel}
            title={profileLabel}
          >
            {initials}
          </Link>
          <CheckForUpdatesButton collapsed variant="pill" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("mt-auto shrink-0 border-t border-[#EBEBEB] px-2 pb-2 pt-3 dark:border-[#262626]", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={account.membershipHref}
          onClick={onMembershipNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
          aria-label={profileLabel}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[11px] font-semibold tracking-wide text-[#4A4A4A] dark:bg-[#2A2A2A] dark:text-[#C8C8C8]"
            aria-hidden
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[13px] font-medium leading-4 text-[#1A1A1A] dark:text-white">
              {account.name}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#6B6B6B] dark:text-[#9A9A9A]" title={account.plan}>
              {account.plan}
            </span>
          </span>
        </Link>
        <CheckForUpdatesButton collapsed={false} variant="pill" />
      </div>
    </div>
  )
}
