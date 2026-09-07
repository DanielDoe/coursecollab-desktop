"use client"

import Link from "next/link"
import { BookOpen, GraduationCap, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

export function FacultyCourseScopePrompt() {
  return (
    <div className="mx-auto flex min-h-[min(420px,60vh)] max-w-lg flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10">
        <GraduationCap className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Select a course to proceed</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        This area is tied to a course. Choose a course from the header, or create one under My Courses, to view
        and manage content here.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="rounded-xl">
          <Link href="/faculty/select-course">Select course</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href={`${FACULTY_DASHBOARD_BASE}/course/exchange`}>
            <Share2 className="mr-2 size-4" />
            Course Exchange
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href={`${FACULTY_DASHBOARD_BASE}/administration/my-courses`}>
            <BookOpen className="mr-2 size-4" />
            My Courses
          </Link>
        </Button>
      </div>
    </div>
  )
}
