"use client"

import { usePathname } from "next/navigation"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { PracticeHubBrowseShell } from "@/components/student/dashboard-v2/PracticeHubBrowseShell"
import { PracticeHubMembershipGate } from "@/components/student/dashboard-v2/PracticeHubMembershipGate"

const PRACTICE_ROOT = "/student/dashboard-v2/practice"

export default function PracticeHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const path = (pathname || "").replace(/\/$/, "")
  const immersive = path.includes("/quiz")
  /** Topics owns its own Notes-style browse + list shell. */
  const isTopicsRoot = path === PRACTICE_ROOT

  if (immersive) {
    return <>{children}</>
  }

  return (
    <PracticeHubMembershipGate>
      <PageEnter className="w-full min-w-0">
        <EmbedModuleCard>
          <div className="p-4 sm:p-5">
            {isTopicsRoot ? (
              children
            ) : (
              <PracticeHubBrowseShell>{children}</PracticeHubBrowseShell>
            )}
          </div>
        </EmbedModuleCard>
      </PageEnter>
    </PracticeHubMembershipGate>
  )
}
