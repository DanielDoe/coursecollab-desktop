import { ReviewIncorrect } from "@/components/review-incorrect"
import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"

export default function ReviewPage({ params }: { params: { attemptId: string } }) {
  // Note: This is a server component, so we can't use useSmartHomeLink hook
  // The ReviewIncorrect component should handle the routing logic
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/student/dashboard-v2" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">CourseCollab</h1>
            </Link>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <StudentProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <ReviewIncorrect attemptId={params.attemptId} />
      </main>
    </div>
  )
}
