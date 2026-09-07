"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { STUDENT_DASHBOARD_V2, resolveStudentDashboardV2Path } from "@/lib/student-v2-routes"
import { useNativeApp } from "@/hooks/use-native-app"

export function MembershipLayout({
  children,
  showBack = true,
  backHref = "/student/membership",
  backLabel = "Back to Plans",
}: {
  children: React.ReactNode
  showBack?: boolean
  backHref?: string
  backLabel?: string
}) {
  const pathname = usePathname()
  const isNative = useNativeApp()
  const inV2Shell = pathname?.startsWith(STUDENT_DASHBOARD_V2) ?? false
  const homeLink = useSmartHomeLink()
  const resolvedBackHref = resolveStudentDashboardV2Path(backHref)
  const resolvedHomeLink = homeLink || STUDENT_DASHBOARD_V2

  if (inV2Shell || isNative) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120]">
      {/* Subtle gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--cc-accent) 6%, transparent), transparent 50%), radial-gradient(circle at 80% 80%, rgba(234,170,0,0.03), transparent 50%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none dark:block hidden"
        style={{
          background: "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--cc-accent) 8%, transparent), transparent 60%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-white/[0.08] backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {showBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="shrink-0 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <Link href={resolvedBackHref}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">{backLabel}</span>
                    <span className="sm:hidden">Back</span>
                  </Link>
                </Button>
              )}
              <Link
                href={resolvedHomeLink}
                className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
              >
                <div
                  className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]"
                >
                  <GraduationCap className="h-5 w-5 text-[var(--cc-accent)]" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white hidden sm:inline">
                  CourseCollab
                </span>
              </Link>
            </div>
            <StudentProfileDropdown />
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        {children}
      </main>
    </div>
  )
}
