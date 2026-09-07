"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, Library, Trash2, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

const QUIZZES_SEGMENTS = [
  { id: "manage", label: "Manage Quizzes", href: "/admin/dashboard-v2/assessments/quizzes", icon: ClipboardList },
  { id: "question-bank", label: "Question Bank", href: "/admin/dashboard-v2/assessments/quizzes/question-bank", icon: Library },
  { id: "deleted", label: "Deleted", href: "/admin/dashboard-v2/assessments/quizzes/deleted", icon: Trash2 },
  { id: "issues", label: "Issues", href: "/admin/dashboard-v2/assessments/quizzes/issues", icon: MessageSquare },
]

export default function QuizzesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isManagePage = pathname === "/admin/dashboard-v2/assessments/quizzes" || pathname === "/admin/dashboard-v2/assessments/quizzes/"
  const isQuestionBankPage = pathname === "/admin/dashboard-v2/assessments/quizzes/question-bank" || pathname.startsWith("/admin/dashboard-v2/assessments/quizzes/question-bank/")

  // Manage page and Question Bank have their own sidebars - no layout sidebar
  if (isManagePage || isQuestionBankPage) {
    return <div className="w-full min-w-0">{children}</div>
  }

  // On deleted, issues - show Quizzes sidebar for navigation
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full min-w-0 overflow-x-hidden">
      <div className="w-full lg:w-56 shrink-0">
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.08]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quizzes</p>
          </div>
          <div className="p-1.5">
            {QUIZZES_SEGMENTS.map((seg) => {
              const isActive =
                seg.href === "/admin/dashboard-v2/assessments/quizzes"
                  ? pathname === seg.href
                  : pathname === seg.href || pathname.startsWith(seg.href + "/")
              const Icon = seg.icon
              const isDeleted = seg.id === "deleted"
              return (
                <Link
                  key={seg.id}
                  href={seg.href}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
                    isDeleted
                      ? isActive
                        ? "bg-red-500/15 dark:bg-red-500/25 text-red-700 dark:text-red-300 font-medium"
                        : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                      : isActive
                        ? "bg-teal-500/15 dark:bg-teal-500/25 text-teal-700 dark:text-teal-300 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{seg.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
