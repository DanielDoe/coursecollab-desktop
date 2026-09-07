"use client"

import {
  Award,
  Code,
  LayoutDashboard,
  PenLine,
  Trophy,
} from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"

export type ClassroomPointsBrowseId =
  | "overview"
  | "code"
  | "solutions"
  | "history"
  | "leaderboard"

export function ClassroomPointsBrowseNav({
  activeId,
  onSelect,
  counts,
  showCode,
  showSolutions,
}: {
  activeId: ClassroomPointsBrowseId
  onSelect: (id: ClassroomPointsBrowseId) => void
  counts?: {
    history?: number
    code?: number
    solutions?: number
  }
  showCode?: boolean
  showSolutions?: boolean
}) {
  const items = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    ...(showCode
      ? [{ id: "code" as const, label: "Code assignments", icon: Code, badge: counts?.code }]
      : []),
    ...(showSolutions
      ? [
          {
            id: "solutions" as const,
            label: "Solution assignments",
            icon: PenLine,
            badge: counts?.solutions,
          },
        ]
      : []),
    {
      id: "history" as const,
      label: "Points history",
      icon: Award,
      badge: counts?.history,
    },
    { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
  ]

  return (
    <FacultyModuleSideMenu
      embedded
      className="lg:border-r lg:border-[var(--border)] lg:pr-4"
      moduleId="classroom-points"
      accent="theme"
      title="Browse"
      activeId={activeId}
      onSelect={(id) => onSelect(id as ClassroomPointsBrowseId)}
      items={items}
    />
  )
}
