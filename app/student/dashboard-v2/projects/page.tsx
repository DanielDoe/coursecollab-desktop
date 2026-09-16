"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy } from "lucide-react"
import type { Project } from "@/lib/types/project"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { ProjectsPageSkeleton } from "@/components/student/dashboard-v2/ProjectsPageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
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
  { loading: () => <ProjectsPageSkeleton showHeader={false} /> },
)
const ProjectsList = dynamic(
  () => import("@/components/projects-list").then((m) => ({ default: m.ProjectsList })),
  { loading: () => <ProjectsPageSkeleton showHeader={false} /> },
)
const ProjectPresentationScheduler = dynamic(
  () =>
    import("@/components/project-presentation-scheduler").then((m) => ({
      default: m.ProjectPresentationScheduler,
    })),
  { ssr: false },
)

export default function DashboardV2ProjectsPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentSection, setStudentSection] = useState("")
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<SectionGroup[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [mounted, setMounted] = useState(false)

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
      setLoadingProjects(true)
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
      } else {
        setAllProjects([])
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups ?? [])
      } else {
        setGroups([])
      }
    } catch {
      setAllProjects([])
      setGroups([])
    } finally {
      setLoadingProjects(false)
    }
  }, [studentSection, studentDatabaseId])

  useEffect(() => {
    void loadSectionData()
  }, [loadSectionData])

  const myApprovedProject = useMemo(() => {
    if (!studentDatabaseId) return null
    const myGroup = groups.find((g) =>
      g.members?.some((m) => m.id === studentDatabaseId),
    )
    if (!myGroup) return null
    return (
      allProjects.find(
        (p) => p.status === "approved" && p.group_id === myGroup.id,
      ) ?? null
    )
  }, [allProjects, groups, studentDatabaseId])

  const sharedSectionData = useMemo(
    () => ({ allProjects, groups, loading: false as const }),
    [allProjects, groups],
  )

  const shell = (content: ReactNode) => (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>{content}</EmbedModuleCard>
    </PageEnter>
  )

  if (!mounted || !studentId || !studentDatabaseId || !studentSection) {
    return shell(<ProjectsPageSkeleton />)
  }

  return shell(
    <div className="space-y-4 p-3 sm:p-4 md:p-5">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Projects
          </p>
          <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
            {loadingProjects ? (
              <span className="inline-block h-4 w-48 animate-pulse rounded bg-[var(--muted)]" />
            ) : (
              <>
                {allProjects.length} in section {studentSection}
                <span className="text-[var(--cc-text-muted)]">
                  {myApprovedProject
                    ? ` · ${myApprovedProject.title}`
                    : " · propose after your group is approved"}
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/student/dashboard-v2/projects/leaderboard"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm text-[var(--cc-text)] hover:bg-[var(--muted)]"
        >
          <Trophy className="h-4 w-4" />
          <span className="hidden sm:inline">Leaderboard</span>
        </Link>
      </div>

      {loadingProjects ? (
        <ProjectsPageSkeleton showHeader={false} />
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] xl:items-start">
            <ProjectsList
              projects={allProjects}
              loading={false}
              studentId={studentDatabaseId}
              showVoting
              embedInDashboard
            />
            <ProjectsManager
              studentId={studentId}
              studentSection={studentSection}
              studentDatabaseId={studentDatabaseId}
              embedInDashboard
              sharedSectionData={sharedSectionData}
              onSectionDataChange={() => void loadSectionData()}
            />
          </div>

          {myApprovedProject ? (
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
          ) : null}
        </>
      )}
    </div>,
  )
}
