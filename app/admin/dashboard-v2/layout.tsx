"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { InstructorDashboardV2Provider } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { InstructorTopbarV2 } from "@/components/instructor/dashboard-v2/InstructorTopbarV2"
import { InstructorSidebarV2 } from "@/components/instructor/dashboard-v2/InstructorSidebarV2"
import { InstructorDashboardBreadcrumbs } from "@/components/instructor/dashboard-v2/InstructorDashboardBreadcrumbs"
import { AdminV2CourseScopeGate } from "@/components/admin/dashboard-v2/AdminV2CourseScopeGate"
import { AdminTeachingRouteGuard } from "@/components/admin/AdminTeachingRouteGuard"
import { InstructorCourseSwitchSplash } from "@/components/instructor/dashboard-v2/InstructorCourseSwitchSplash"
import { dashboardV2ShellMainClass } from "@/lib/dashboard-v2-layout"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getAdminData } from "@/lib/auth"
import { PlatformActivityTracker } from "@/components/platform-activity-tracker"
import { NavSidebarCollapseEffect } from "@/components/dashboard-v2/NavSidebarCollapseEffect"
import { PresenceSelfProvider } from "@/components/presence/PresenceSelfProvider"
import { ADMIN_DASHBOARD_V2_BASE } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { CourseScopeRemountBoundary } from "@/components/instructor/CourseScopeRemountBoundary"

const ADMIN_DASHBOARD_LANDING_PATHS = [ADMIN_DASHBOARD_V2_BASE]

function NavSidebarCollapseEffectWrapper() {
  const { setSidebarCollapsed, setMobileSidebarOpen } = useInstructorDashboardV2()
  return (
    <NavSidebarCollapseEffect
      landingPaths={ADMIN_DASHBOARD_LANDING_PATHS}
      setSidebarCollapsed={setSidebarCollapsed}
      setMobileSidebarOpen={setMobileSidebarOpen}
    />
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useInstructorDashboardV2()

  return (
    <main
      className={`flex-1 min-w-0 min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] overflow-x-hidden transition-[margin-left] duration-300 ease-out ${
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
      } ${dashboardV2ShellMainClass}`}
    >
      <InstructorDashboardBreadcrumbs />
      <CourseScopeRemountBoundary>{children}</CourseScopeRemountBoundary>
    </main>
  )
}

export default function AdminDashboardV2Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const adminData = getAdminData()
    if (!adminData && pathname?.startsWith("/admin/dashboard-v2")) {
      router.push("/admin/login")
    }
  }, [router, pathname])

  return (
    <InstructorDashboardV2Provider portal="admin">
      <PresenceSelfProvider>
      <AdminV2CourseScopeGate>
        <div className="admin-dashboard-v2 instructor-dashboard-v2 min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white antialiased">
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 15% 15%, rgba(99,102,241,0.08), transparent 45%), radial-gradient(circle at 85% 85%, rgba(168,85,247,0.05), transparent 45%)",
            }}
          />
          <div
            className="fixed inset-0 pointer-events-none dark:block hidden"
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.04), transparent 50%)",
            }}
          />
          <div
            className="fixed top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-20 hidden dark:block"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="fixed bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none opacity-12 hidden dark:block"
            style={{
              background: "radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)",
              filter: "blur(80px)",
            }}
          />

          <div className="relative z-10">
            <InstructorTopbarV2 />
            <NavSidebarCollapseEffectWrapper />
            <div className="flex">
              <InstructorSidebarV2 />
              <DashboardContent>
            <AdminTeachingRouteGuard>{children}</AdminTeachingRouteGuard>
          </DashboardContent>
            </div>
          </div>
          <InstructorCourseSwitchSplash />
          <PlatformActivityTracker />
        </div>
      </AdminV2CourseScopeGate>
      </PresenceSelfProvider>
    </InstructorDashboardV2Provider>
  )
}
