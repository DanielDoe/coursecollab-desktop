"use client"

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import {
  InstructorClassroomPoints,
  type ClassroomPointsNavSection,
} from "@/components/instructor-classroom-points"
import { ClipboardList, BarChart3, Clock, History, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS: {
  id: ClassroomPointsNavSection
  label: string
  icon: typeof ClipboardList
}[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "code-submissions", label: "Assignments", icon: ClipboardList },
  { id: "pending-approvals", label: "Pending Approvals", icon: Clock },
  { id: "recent-awards", label: "Recent Awards", icon: History },
  { id: "students", label: "Leaderboard", icon: Users },
  { id: "configuration", label: "Configuration", icon: Settings },
]

export default function AssessmentsClassroomPointsPage() {
  const refreshRef = useRef<(() => void) | null>(null)
  const [activeSection, setActiveSection] = useState<ClassroomPointsNavSection>("overview")

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="w-full lg:w-56 shrink-0">
              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.08]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Classroom Points
                  </p>
                </div>
                <nav className="p-1.5 flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {SECTIONS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeSection === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveSection(id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 lg:shrink",
                          isActive
                            ? "bg-teal-100 dark:bg-teal-950/50 text-teal-900 dark:text-teal-100 font-medium"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-teal-700 dark:hover:text-teal-300",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <InstructorClassroomPoints onRefreshRef={refreshRef} activeSection={activeSection} />
            </div>
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
