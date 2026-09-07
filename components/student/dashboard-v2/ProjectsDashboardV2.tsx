"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Trophy, UserRound, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import type { Project } from "@/lib/types/project"
import { getStudentData } from "@/lib/auth"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"

type SectionGroup = {
  id: number
  name: string
  status: string
  members?: { id: number }[]
}

const ProjectsManager = dynamic(
  () => import("@/components/projects-manager").then((m) => ({ default: m.ProjectsManager })),
  { ssr: false },
)
const ProjectsList = dynamic(
  () => import("@/components/projects-list").then((m) => ({ default: m.ProjectsList })),
  { ssr: false },
)
const ProjectPresentationScheduler = dynamic(
  () =>
    import("@/components/project-presentation-scheduler").then((m) => ({
      default: m.ProjectPresentationScheduler,
    })),
  { ssr: false },
)

type MenuView = "all" | "mine" | "schedule"

export function ProjectsDashboardV2() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentSection, setStudentSection] = useState("")
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<SectionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>("all")

  useEffect(() => {
    const session = getStudentData()
    const dbId = session?.databaseId ?? sessionStorage.getItem("studentDatabaseId")
    const id = session?.id ?? sessionStorage.getItem("studentId")
    const section = session?.section ?? sessionStorage.getItem("studentSection")

    if (!id || !dbId) {
      router.push("/student/login")
      return
    }

    setStudentDatabaseId(Number.parseInt(dbId, 10))
    setStudentId(id)
    setStudentSection(section || "")
    setMounted(true)
  }, [router])

  const loadSectionData = useCallback(async () => {
    if (!studentSection || !studentDatabaseId) return

    try {
      setLoading(true)
      const projectParams = buildStudentScopedSearchParams({ session: studentSection })
      const groupParams = buildStudentScopedSearchParams({
        session: studentSection,
        studentId: String(studentDatabaseId),
      })

      const [projectsRes, groupsRes] = await Promise.all([
        fetch(`/api/projects/list?${projectParams}`),
        fetch(`/api/groups?${groupParams}`, {
          headers: { "x-student-id": String(studentDatabaseId) },
        }),
      ])

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setAllProjects(data.projects ?? [])
      } else setAllProjects([])

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups ?? [])
      } else setGroups([])
    } catch {
      setAllProjects([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [studentSection, studentDatabaseId])

  useEffect(() => {
    void loadSectionData()
  }, [loadSectionData])

  const myApprovedProject = useMemo(() => {
    if (!studentDatabaseId) return null
    const myGroup = groups.find((g) => g.members?.some((m) => m.id === studentDatabaseId))
    if (!myGroup) return null
    return allProjects.find((p) => p.status === "approved" && p.group_id === myGroup.id) ?? null
  }, [allProjects, groups, studentDatabaseId])

  const sharedSectionData = useMemo(
    () => ({ allProjects, groups, loading: false as const }),
    [allProjects, groups],
  )

  const headerAction = (
    <Button
      asChild
      variant="ghost"
      className="h-9 shrink-0 rounded-xl px-2.5 text-sm text-[var(--cc-text)] hover:bg-[var(--muted)]"
    >
      <Link href="/student/dashboard-v2/projects/leaderboard">
        <Trophy className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Leaderboard</span>
      </Link>
    </Button>
  )

  if (!mounted || !studentId || !studentDatabaseId || !studentSection) {
    return (
      <StudentModuleHubLayout
        moduleId="projects"
        title="Projects"
        metaLine="Loading…"
        headerAction={headerAction}
        menuView={menuView}
        onMenuSelect={(id) => setMenuView(id as MenuView)}
        menuItems={[
          { id: "all", label: "All projects", icon: ClipboardList },
          { id: "mine", label: "My project", icon: UserRound },
          { id: "schedule", label: "Schedule", icon: Calendar },
        ]}
        loading
      >
        {null}
      </StudentModuleHubLayout>
    )
  }

  const metaLine = loading ? (
    <span className="inline-block h-4 w-52 animate-pulse rounded bg-[var(--muted)]" />
  ) : (
    <>
      {allProjects.length} in section {studentSection}
      {myApprovedProject ? ` · ${myApprovedProject.title}` : " · propose after your group is approved"}
    </>
  )

  return (
    <StudentModuleHubLayout
      moduleId="projects"
      title="Projects"
      metaLine={metaLine}
      metaSuffix="vote, propose, and schedule presentations"
      headerAction={headerAction}
      menuView={menuView}
      onMenuSelect={(id) => setMenuView(id as MenuView)}
      menuItems={[
        { id: "all", label: "All projects", icon: ClipboardList, badge: allProjects.length || undefined },
        {
          id: "mine",
          label: "My project",
          icon: UserRound,
          badge: myApprovedProject ? 1 : undefined,
        },
        {
          id: "schedule",
          label: "Schedule",
          icon: Calendar,
          badge: myApprovedProject ? 1 : undefined,
        },
      ]}
      loading={loading}
    >
      {menuView === "all" ? (
        <ProjectsList
          projects={allProjects}
          loading={false}
          studentId={studentDatabaseId}
          showVoting
          embedInDashboard
        />
      ) : menuView === "mine" ? (
        <ProjectsManager
          studentId={studentId}
          studentSection={studentSection}
          studentDatabaseId={studentDatabaseId}
          embedInDashboard
          sharedSectionData={sharedSectionData}
          onSectionDataChange={() => void loadSectionData()}
        />
      ) : myApprovedProject ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Schedule presentation</h3>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            Book a 20-minute slot for {myApprovedProject.title}
          </p>
          <div className="mt-3">
            <ProjectPresentationScheduler
              projectId={myApprovedProject.id}
              groupId={myApprovedProject.group_id}
              projectTitle={myApprovedProject.title}
              groupName={myApprovedProject.group?.name || ""}
              studentSession={studentSection}
            />
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[var(--cc-accent)]" />
          <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">No approved project yet</p>
          <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
            Once your group project is approved, you can book a presentation slot here.
          </p>
        </div>
      )}
    </StudentModuleHubLayout>
  )
}
