"use client"

import { usePathname } from "next/navigation"
import { ClipboardList, Library, Trash2, MessageSquare } from "lucide-react"
import { facultyDashboardCanonicalPath } from "@/lib/faculty-dashboard-path"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"

const QUIZZES_BASE = "/instructor/dashboard-v2/assessments/quizzes"

const QUIZZES_SEGMENTS = [
  { id: "manage", label: "Manage Quizzes", href: `${QUIZZES_BASE}`, icon: ClipboardList },
  { id: "question-bank", label: "Question Bank", href: `${QUIZZES_BASE}/question-bank`, icon: Library },
  { id: "deleted", label: "Deleted", href: `${QUIZZES_BASE}/deleted`, icon: Trash2, tone: "destructive" as const },
  { id: "issues", label: "Issues", href: `${QUIZZES_BASE}/issues`, icon: MessageSquare },
]

function activeSegmentId(pathname: string): string {
  if (pathname === QUIZZES_BASE || pathname === `${QUIZZES_BASE}/`) return "manage"
  if (pathname.startsWith(`${QUIZZES_BASE}/question-bank`)) return "question-bank"
  if (pathname.startsWith(`${QUIZZES_BASE}/deleted`)) return "deleted"
  if (pathname.startsWith(`${QUIZZES_BASE}/issues`)) return "issues"
  return "manage"
}

export default function QuizzesLayout({ children }: { children: React.ReactNode }) {
  const pathname = facultyDashboardCanonicalPath(usePathname())
  const isManagePage = pathname === QUIZZES_BASE || pathname === `${QUIZZES_BASE}/`
  const isQuestionBankPage =
    pathname === `${QUIZZES_BASE}/question-bank` ||
    pathname.startsWith(`${QUIZZES_BASE}/question-bank/`)

  if (isManagePage || isQuestionBankPage) {
    return <div className="w-full min-w-0">{children}</div>
  }

  return (
    <FacultyModuleSplitLayout
      menu={
        <FacultyModuleSideMenu
          moduleId="quizzes"
          title="Quizzes"
          activeId={activeSegmentId(pathname)}
          items={QUIZZES_SEGMENTS}
        />
      }
    >
      {children}
    </FacultyModuleSplitLayout>
  )
}
