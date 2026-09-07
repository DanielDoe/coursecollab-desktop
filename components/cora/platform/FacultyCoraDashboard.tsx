"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "@/components/student/dashboard-v2/light-motion"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyCoraPlatformNav } from "@/components/cora/platform/FacultyCoraPlatformNav"
import { FacultyCoraHomePanel } from "@/components/cora/platform/FacultyCoraHomePanel"
import { FacultyCoraWorkspacePanel } from "@/components/cora/platform/FacultyCoraWorkspacePanel"
import { FacultyCoraInsightsPanel } from "@/components/cora/platform/FacultyCoraInsightsPanel"
import { FacultyCoraAutomatePanel } from "@/components/cora/platform/FacultyCoraAutomatePanel"
import { FacultyCoraPreferencesPanel } from "@/components/cora/platform/FacultyCoraPreferencesPanel"
import { FacultyCoraCapabilityPanel } from "@/components/cora/platform/FacultyCoraCapabilityPanel"
import { FacultyCoraSetupOverlay } from "@/components/cora/platform/FacultyCoraSetupOverlay"
import { useFacultyCoraContext } from "@/hooks/use-faculty-cora-context"
import { useCoraChrome } from "@/hooks/use-cora-chrome"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorData } from "@/lib/auth"
import {
  facultyCoraCapability,
  type FacultyCoraCapability,
} from "@/lib/cora/faculty-capabilities"
import {
  isFacultyCoraCapabilityTab,
  type FacultyCoraPlatformTab,
} from "@/lib/cora/faculty-platform-nav"
import { cn } from "@/lib/utils"

export type FacultyCoraWorkspaceBootstrap = {
  capabilityId?: string
  prompt?: string
  nonce: number
}

export function FacultyCoraDashboard() {
  const chrome = useCoraChrome()
  const { coraImmersive, setCoraImmersive } = useInstructorDashboardV2()
  const [activeTab, setActiveTab] = useState<FacultyCoraPlatformTab>("home")
  const [instructorName, setInstructorName] = useState<string>()
  const [workspaceBootstrap, setWorkspaceBootstrap] = useState<FacultyCoraWorkspaceBootstrap | null>(null)

  const {
    status,
    setupStep,
    error,
    courseTitle,
    courseCode,
    insights,
    capabilities,
    retrySetup,
    skipSetup,
  } = useFacultyCoraContext(true)

  useEffect(() => {
    const data = getInstructorData() as { name?: string; fullName?: string } | null
    setInstructorName(data?.name ?? data?.fullName)
  }, [])

  useEffect(() => {
    if (activeTab !== "workspace" && coraImmersive) setCoraImmersive(false)
  }, [activeTab, coraImmersive, setCoraImmersive])

  useEffect(() => {
    if (!coraImmersive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCoraImmersive(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [coraImmersive, setCoraImmersive])

  const startCapability = useCallback((capability: FacultyCoraCapability, prompt?: string) => {
    setWorkspaceBootstrap({
      capabilityId: capability.id,
      prompt,
      nonce: Date.now(),
    })
    setActiveTab("workspace")
  }, [])

  const courseLabel = [courseCode, courseTitle].filter(Boolean).join(" · ") || null
  const showSetup = status === "loading" || status === "error"
  const activeCapability = isFacultyCoraCapabilityTab(activeTab)
    ? capabilities.find((item) => item.id === activeTab) ?? facultyCoraCapability(activeTab)
    : null

  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-x-hidden",
        coraImmersive ? "flex h-full min-h-0 flex-col" : "space-y-3 sm:space-y-4",
      )}
    >
      <div
        className={cn(
          "relative",
          coraImmersive && "flex min-h-0 flex-1 flex-col",
        )}
      >
        <FacultyModuleSplitLayout
          className={cn("min-w-0 gap-2 sm:gap-3 lg:gap-4", coraImmersive && "h-full min-h-0")}
          menuWidthClass="w-full lg:w-52 xl:w-56"
          menu={
            coraImmersive ? null : (
              <FacultyCoraPlatformNav activeTab={activeTab} onNavigate={setActiveTab} chrome={chrome} />
            )
          }
        >
          <div
            className={cn(
              "relative",
              coraImmersive ? "flex h-full min-h-0 flex-1 flex-col" : "min-h-[min(70vh,760px)]",
            )}
          >
            <AnimatePresence mode="wait">
              {activeTab === "home" && (
                <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <FacultyCoraHomePanel
                    instructorName={instructorName}
                    courseCode={courseCode}
                    courseLabel={courseLabel}
                    capabilities={capabilities}
                    insights={insights}
                    chrome={chrome}
                    onOpenCapability={(capability) => setActiveTab(capability.id)}
                    onStartCapability={startCapability}
                    onOpenInsights={() => setActiveTab("insights")}
                    onOpenWorkspace={() => setActiveTab("workspace")}
                  />
                </motion.div>
              )}

              {activeTab === "workspace" && (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    "min-w-0",
                    coraImmersive ? "h-full min-h-0" : "h-[min(calc(100dvh-14rem),720px)] sm:h-[min(78vh,820px)]",
                  )}
                >
                  <FacultyCoraWorkspacePanel
                    capabilityId={workspaceBootstrap?.capabilityId}
                    initialPrompt={workspaceBootstrap?.prompt}
                    bootstrapNonce={workspaceBootstrap?.nonce}
                    fillHeight
                    immersive={coraImmersive}
                    onToggleImmersive={() => setCoraImmersive(!coraImmersive)}
                  />
                </motion.div>
              )}

              {activeCapability ? (
                <motion.div
                  key={activeCapability.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="min-w-0"
                >
                  <FacultyCoraCapabilityPanel
                    capability={activeCapability}
                    chrome={chrome}
                    onAsk={startCapability}
                  >
                    {activeTab === "insights" ? (
                      <FacultyCoraInsightsPanel
                        initialInsights={insights}
                        capabilities={capabilities}
                        onStartCapability={startCapability}
                      />
                    ) : null}
                    {activeTab === "automate" ? <FacultyCoraAutomatePanel /> : null}
                  </FacultyCoraCapabilityPanel>
                </motion.div>
              ) : null}

              {activeTab === "preferences" && (
                <motion.div key="preferences" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <FacultyCoraPreferencesPanel />
                </motion.div>
              )}
            </AnimatePresence>

            <FacultyCoraSetupOverlay
              open={showSetup}
              step={setupStep}
              error={error}
              onRetry={() => void retrySetup()}
              onDismiss={skipSetup}
            />
          </div>
        </FacultyModuleSplitLayout>
      </div>
    </div>
  )
}
