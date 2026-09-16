"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { SemesterTimeline } from "@/components/student/dashboard-v2/SemesterTimeline"
import { Calendar } from "lucide-react"
import Link from "next/link"

export default function SemesterTimelinePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 overflow-x-hidden pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-6 w-6 text-[var(--cc-accent-dark)]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Semester Timeline
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Your full course schedule — timeline spine and table view. Open assignments,
            assignments, upcoming releases, syllabus dates, and completed work in one place.
          </p>
        </div>
        <Link
          href="/student/dashboard-v2/calendar"
          className="text-sm font-medium text-[var(--cc-accent-dark)] hover:underline shrink-0"
        >
          Open calendar →
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SemesterTimeline showFilters />
      </div>
    </motion.div>
  )
}
