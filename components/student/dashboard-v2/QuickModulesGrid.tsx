"use client"

import { useEffect, useState } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import Link from "next/link"
import {
  ClipboardList,
  Lightbulb,
  Code2,
  BookOpen,
  Trophy,
  Megaphone,
  Calendar,
  ChartColumn,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { studentModuleIconBadgeClass } from "@/lib/student-module-themes"
import { resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"
import { cachedFetchJson } from "@/lib/student-client-cache"
import { CardWrapper } from "./CardWrapper"
import type { MembershipTier } from "@/lib/membership-constants"
import { canAccessAiTutor } from "@/lib/ai-tutor-access"
import { CORA_NAV_LABEL } from "@/lib/cora/constants"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"

const TIER_ORDER: Record<MembershipTier, number> = {
  Scholar: 0,
  Explorer: 1,
  Trailblazer: 2,
}

function hasMinTier(tier: MembershipTier | null, minTier: MembershipTier): boolean {
  if (!tier) return false
  return TIER_ORDER[tier] >= TIER_ORDER[minTier]
}

const MODULES = [
  { id: "quizzes", title: "Quizzes", href: "/student/dashboard-v2/quizzes", icon: ClipboardList, minTier: null as MembershipTier | null },
  { id: "practice", title: "Practice Hub", href: "/student/dashboard-v2/practice", icon: Lightbulb, minTier: "Explorer" as MembershipTier },
  { id: "codebench", title: "CodeBench", href: "/student/dashboard-v2/codebench", icon: Code2, minTier: null },
  { id: "ai-tutor", title: CORA_NAV_LABEL, href: "/student/dashboard-v2/ai-tutor", icon: CoraSidebarMark, minTier: null },
  { id: "lectures", title: "Lectures", href: "/student/dashboard-v2/lectures", icon: BookOpen, minTier: null },
  { id: "classroom-points", title: "Classroom Points", href: "/student/dashboard-v2/classroom-points", icon: Trophy, minTier: null },
  { id: "announcements", title: "Announcements", href: "/student/dashboard-v2/announcements", icon: Megaphone, minTier: null },
  { id: "calendar", title: "Calendar", href: "/student/dashboard-v2/calendar", icon: Calendar, minTier: null },
  { id: "grades", title: "Grades", href: "/student/dashboard-v2/grades", icon: ChartColumn, minTier: null },
]

/** Quick Modules — icon tint matches sidebar module accent */
export function QuickModulesGrid() {
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null)

  useEffect(() => {
    const studentId = resolveStudentDatabaseId()
    if (!studentId) return
    void cachedFetchJson(
      `membership:${studentId}`,
      async () => {
        const res = await studentApiFetch(`/api/student/membership?studentId=${studentId}`)
        if (!res.ok) throw new Error("membership")
        return res.json()
      },
      300_000,
    )
      .then((data) => {
        const tier = data?.membership?.tier as MembershipTier | undefined
        if (tier) setMembershipTier(tier)
      })
      .catch(() => {})
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 }}
    >
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
        Launch
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module, i) => {
          const Icon = module.icon
          const locked =
            module.id === "ai-tutor"
              ? membershipTier != null && !canAccessAiTutor(membershipTier)
              : module.minTier != null && !hasMinTier(membershipTier, module.minTier)
          const Wrapper = locked ? "div" : Link
          const wrapperProps = locked
            ? {}
            : { href: module.href }

          return (
            <CardWrapper key={module.id} delay={0.05 * i}>
              <Wrapper
                {...wrapperProps}
                className={cn(
                  "block p-4 transition-transform duration-300 hover:-translate-y-0.5",
                  locked && "cursor-not-allowed opacity-75"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={studentModuleIconBadgeClass(module.id)}>
                    {module.id === "ai-tutor" ? (
                      <CoraSidebarMark />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-[var(--cc-text)]">{module.title}</p>
                      {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--cc-warning)]" />}
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
                      {locked ? "Upgrade to unlock" : "Open"}
                    </p>
                  </div>
                </div>
              </Wrapper>
            </CardWrapper>
          )
        })}
      </div>
    </motion.div>
  )
}
