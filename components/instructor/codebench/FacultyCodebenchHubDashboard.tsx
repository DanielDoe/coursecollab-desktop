"use client"

import "@/components/instructor/codebench/instructor-codebench-ui.css"
import { useCallback, useMemo, useState } from "react"
import {
  Activity,
  BookOpen,
  Code2,
  FolderKanban,
  LayoutDashboard,
  Radio,
  Settings2,
  Target,
  Users,
} from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyCodebenchStudioAnalytics } from "@/components/instructor/analytics/FacultyCodebenchStudioAnalytics"
import { InstructorCodebenchIde } from "@/components/instructor/codebench/InstructorCodebenchIde"
import { InstructorCodeLibraryPanel } from "@/components/instructor/codebench/InstructorCodeLibraryPanel"
import { InstructorCodebenchProjectsPanel } from "@/components/instructor/codebench/InstructorCodebenchProjectsPanel"
import { InstructorCodebenchActivityPanel } from "@/components/instructor/codebench/InstructorCodebenchActivityPanel"
import { InstructorCodebenchChallengesPanel } from "@/components/instructor/codebench/InstructorCodebenchChallengesPanel"
import { InstructorCodebenchLivePanel } from "@/components/instructor/codebench/InstructorCodebenchLivePanel"
import { InstructorLiveClassroomSession } from "@/components/instructor/codebench/InstructorLiveClassroomSession"
import { InstructorCodebenchSettingsPanel } from "@/components/instructor/codebench/InstructorCodebenchSettingsPanel"
import type { InstructorLibraryItem } from "@/lib/codebench-instructor-library"
import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const MODULE_ID = "codebench"

type HubView =
  | "workspace"
  | "library"
  | "projects"
  | "challenges"
  | "live"
  | "live_session"
  | "activity"
  | "insights"
  | "settings"

const MENU_ITEMS = [
  { id: "workspace" as const, label: "My Workspace", icon: Code2 },
  { id: "library" as const, label: "Code Library", icon: BookOpen },
  { id: "projects" as const, label: "Projects", icon: FolderKanban },
  { id: "challenges" as const, label: "Challenges", icon: Target },
  { id: "live" as const, label: "Live Classroom", icon: Radio },
  { id: "activity" as const, label: "Student Activity", icon: Users },
  { id: "insights" as const, label: "Insights", icon: Activity },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
]

export function FacultyCodebenchHubDashboard() {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const [view, setView] = useState<HubView>("workspace")
  const isWorkspaceView = view === "workspace" || view === "live_session"
  const [libraryImport, setLibraryImport] = useState<InstructorLibraryItem | null>(null)
  const [classroomImport, setClassroomImport] = useState<InstructorClassroomHandoff | null>(null)
  const [liveSessionHandoff, setLiveSessionHandoff] = useState<InstructorClassroomHandoff | null>(null)

  const openWorkspace = useCallback(() => setView("workspace"), [])
  const openChallenges = useCallback(() => setView("challenges"), [])

  const handleOpenLibraryItem = useCallback((item: InstructorLibraryItem) => {
    setClassroomImport(null)
    setLibraryImport(item)
    setView("workspace")
  }, [])

  const handleOpenClassroomInIde = useCallback((handoff: InstructorClassroomHandoff) => {
    setLibraryImport(null)
    setLiveSessionHandoff(null)
    setClassroomImport(handoff)
    setView("workspace")
  }, [])

  const handleStartLiveSession = useCallback((handoff: InstructorClassroomHandoff) => {
    setLibraryImport(null)
    setClassroomImport(null)
    setLiveSessionHandoff(handoff)
    setView("live_session")
  }, [])

  const handleExitLiveSession = useCallback(() => {
    setLiveSessionHandoff(null)
    setView("live")
    // Leaving the classroom must not clear the course chosen in the header.
    window.dispatchEvent(new Event("instructor-course-display-sync"))
  }, [])

  const content = useMemo(() => {
    switch (view) {
      case "workspace":
        return (
          <InstructorCodebenchIde
            className="h-full min-h-[min(520px,calc(100dvh-14rem))] flex-1 lg:min-h-0"
            importLibraryItem={libraryImport}
            onLibraryImportHandled={() => setLibraryImport(null)}
            importClassroomAssignment={classroomImport}
            onClassroomImportHandled={() => setClassroomImport(null)}
          />
        )
      case "library":
        return (
          <InstructorCodeLibraryPanel
            onOpenInIde={handleOpenLibraryItem}
            onOpenClassroomInIde={handleOpenClassroomInIde}
          />
        )
      case "projects":
        return <InstructorCodebenchProjectsPanel onOpenWorkspace={openWorkspace} />
      case "challenges":
        return (
          <InstructorCodebenchChallengesPanel
            onOpenClassroomInIde={handleOpenClassroomInIde}
            onOpenLibraryInIde={handleOpenLibraryItem}
          />
        )
      case "live":
      case "live_session":
        return (
          <>
            <div className={view === "live" ? "contents" : "hidden"} aria-hidden={view !== "live"}>
              <InstructorCodebenchLivePanel
                onStartLiveSession={handleStartLiveSession}
                onOpenClassroomInIde={handleOpenClassroomInIde}
                onOpenChallenges={openChallenges}
              />
            </div>
            {view === "live_session" && liveSessionHandoff ? (
              <InstructorLiveClassroomSession
                handoff={liveSessionHandoff}
                onBack={handleExitLiveSession}
                onOpenInIde={handleOpenClassroomInIde}
              />
            ) : null}
          </>
        )
      case "activity":
        return <InstructorCodebenchActivityPanel />
      case "insights":
        return <FacultyCodebenchStudioAnalytics />
      case "settings":
        return <InstructorCodebenchSettingsPanel />
      default:
        return null
    }
  }, [
    classroomImport,
    handleExitLiveSession,
    handleOpenClassroomInIde,
    handleOpenLibraryItem,
    handleStartLiveSession,
    libraryImport,
    liveSessionHandoff,
    openChallenges,
    openWorkspace,
    view,
  ])

  return (
    <div
      className={cn(
        "@container/codebench-hub flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        isWorkspaceView ? "gap-2" : "gap-3",
      )}
    >
      {view !== "live_session" ? (
        <div className={cn(chrome.card, "shrink-0 space-y-1 px-4 py-3")}>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[var(--cc-accent)]" />
            <h1 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Instructor CodeBench</h1>
          </div>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Write, organize, teach, and observe — a programming teaching environment built on the same execution stack as
            student CodeBench.
          </p>
        </div>
      ) : null}

      <FacultyModuleSplitLayout
        className="min-h-0 flex-1"
        scrollMode="panel"
        splitMode="container"
        containerName="faculty-split"
        menu={
          <FacultyModuleSideMenu
            moduleId={MODULE_ID}
            title="CodeBench"
            items={MENU_ITEMS}
            activeId={view === "live_session" ? "live" : view}
            onSelect={(id) => setView(id as HubView)}
            embedded
            hideTitle
          />
        }
      >
        <div
          className={cn(
            "instructor-codebench-panel @container/codebench-panel flex min-h-0 min-w-0 flex-1 flex-col",
            isWorkspaceView
              ? "overflow-hidden"
              : "instructor-codebench-scroll scrollbar-themed overflow-y-auto overflow-x-hidden overscroll-contain",
          )}
        >
          {content}
        </div>
      </FacultyModuleSplitLayout>
    </div>
  )
}
