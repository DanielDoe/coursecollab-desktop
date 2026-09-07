"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { dashboardV2ShellMainClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"
import { InstitutionDashboardProvider, useInstitutionDashboard } from "./InstitutionDashboardContext"
import { InstitutionSidebar } from "./InstitutionSidebar"
import { InstitutionTopbar } from "./InstitutionTopbar"
import { InstitutionBreadcrumbs } from "./InstitutionBreadcrumbs"

function MobileSidebarCloseOnNavigate() {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useInstitutionDashboard()
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])
  return null
}

function InstitutionShellBody({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useInstitutionDashboard()

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden pt-16">
      <InstitutionSidebar />
      <main
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-[margin-left] duration-300 ease-out",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-72",
          dashboardV2ShellMainClass,
        )}
      >
        <InstitutionBreadcrumbs />
        {children}
      </main>
    </div>
  )
}

export function InstitutionShell({ children }: { children: ReactNode }) {
  return (
    <InstitutionDashboardProvider>
      <div className="dashboard-v2-premium flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--cc-background)] text-[var(--cc-text)] antialiased">
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(124,58,237,0.05), transparent 45%), radial-gradient(circle at 85% 85%, rgba(234,170,0,0.03), transparent 45%)",
          }}
        />
        <div className="dashboard-v2-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <InstitutionTopbar />
          <MobileSidebarCloseOnNavigate />
          <InstitutionShellBody>{children}</InstitutionShellBody>
        </div>
      </div>
    </InstitutionDashboardProvider>
  )
}
