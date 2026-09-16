"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { GroupsPageSkeleton } from "@/components/student/dashboard-v2/GroupsPageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"

const GroupsManager = dynamic(
  () => import("@/components/groups-manager").then((m) => ({ default: m.GroupsManager })),
  { loading: () => <GroupsPageSkeleton showHeader={false} /> },
)

const GroupRequestsPanel = dynamic(
  () =>
    import("@/components/group-requests-panel").then((m) => ({ default: m.GroupRequestsPanel })),
  { loading: () => <GroupsPageSkeleton showHeader={false} /> },
)

export default function DashboardV2GroupsPage() {
  const router = useRouter()
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)
  const [studentSection, setStudentSection] = useState("")
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<unknown[]>([])
  const [students, setStudents] = useState<unknown[]>([])
  const [discovery, setDiscovery] = useState({
    openGroups: [] as unknown[],
    studentsWithoutGroup: [] as unknown[],
    openCalls: [] as unknown[],
  })
  const [requests, setRequests] = useState({
    incomingJoinRequests: [] as unknown[],
    outgoingJoinRequests: [] as unknown[],
    incomingLinkRequests: [] as unknown[],
    outgoingLinkRequests: [] as unknown[],
  })

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
    setStudentSection(section || "")
    setMounted(true)
  }, [router])

  const loadSectionData = useCallback(async () => {
    if (!studentSection || !studentDatabaseId) return

    try {
      setLoading(true)
      const groupParams = buildStudentScopedSearchParams({ session: studentSection })
      const rosterParams = buildStudentScopedSearchParams({ section: studentSection })
      const discoverParams = buildStudentScopedSearchParams({ session: studentSection })
      const myReqParams = buildStudentScopedSearchParams({
        studentId: String(studentDatabaseId),
        session: studentSection,
      })

      const [groupsRes, rosterRes, discoverRes, myReqRes] = await Promise.all([
        fetch(`/api/groups?${groupParams}`),
        studentApiFetch(`/api/student/roster?${rosterParams}`),
        fetch(`/api/groups/requests/discover?${discoverParams}`),
        fetch(`/api/groups/requests/my-requests?${myReqParams}`),
      ])

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups ?? [])
      } else {
        setGroups([])
      }

      if (rosterRes.ok) {
        const data = await rosterRes.json()
        setStudents(
          (data.students ?? []).map((s: Record<string, unknown>) => ({
            ...s,
            section: studentSection,
          })),
        )
      } else {
        setStudents([])
      }

      if (discoverRes.ok) {
        const data = await discoverRes.json()
        if (data.ok) {
          setDiscovery({
            openGroups: data.data?.openGroups ?? [],
            studentsWithoutGroup: data.data?.studentsWithoutGroup ?? [],
            openCalls: data.data?.openCalls ?? [],
          })
        } else {
          setDiscovery({ openGroups: [], studentsWithoutGroup: [], openCalls: [] })
        }
      } else {
        setDiscovery({ openGroups: [], studentsWithoutGroup: [], openCalls: [] })
      }

      if (myReqRes.ok) {
        const data = await myReqRes.json()
        if (data.ok) {
          setRequests({
            incomingJoinRequests: data.data?.incomingJoinRequests ?? [],
            outgoingJoinRequests: data.data?.outgoingJoinRequests ?? [],
            incomingLinkRequests: data.data?.incomingLinkRequests ?? [],
            outgoingLinkRequests: data.data?.outgoingLinkRequests ?? [],
          })
        } else {
          setRequests({
            incomingJoinRequests: [],
            outgoingJoinRequests: [],
            incomingLinkRequests: [],
            outgoingLinkRequests: [],
          })
        }
      } else {
        setRequests({
          incomingJoinRequests: [],
          outgoingJoinRequests: [],
          incomingLinkRequests: [],
          outgoingLinkRequests: [],
        })
      }
    } catch {
      setGroups([])
      setStudents([])
      setDiscovery({ openGroups: [], studentsWithoutGroup: [], openCalls: [] })
      setRequests({
        incomingJoinRequests: [],
        outgoingJoinRequests: [],
        incomingLinkRequests: [],
        outgoingLinkRequests: [],
      })
    } finally {
      setLoading(false)
    }
  }, [studentSection, studentDatabaseId])

  useEffect(() => {
    void loadSectionData()
  }, [loadSectionData])

  const sharedGroupsData = useMemo(
    () => ({ groups, students, loading: false as const }),
    [groups, students],
  )

  const sharedDiscoveryData = useMemo(
    () => ({
      ...discovery,
      ...requests,
      loading: false as const,
    }),
    [discovery, requests],
  )

  const shell = (content: ReactNode) => (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>{content}</EmbedModuleCard>
    </PageEnter>
  )

  if (!mounted || !studentDatabaseId || !studentSection) {
    return shell(<GroupsPageSkeleton />)
  }

  return shell(
    <div className="space-y-4 p-3 sm:p-4 md:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          Groups
        </p>
        <p className="mt-0.5 text-sm text-[var(--cc-text)]">
          {loading ? (
            <span className="inline-block h-4 w-64 animate-pulse rounded bg-[var(--muted)]" />
          ) : (
            <>
              Section {studentSection}
              <span className="text-[var(--cc-text-muted)]">
                {" "}
                · {groups.length} group{groups.length === 1 ? "" : "s"} · propose or join one that&apos;s open
              </span>
            </>
          )}
        </p>
      </div>

      {loading ? (
        <GroupsPageSkeleton showHeader={false} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
          <GroupsManager
            studentDatabaseId={studentDatabaseId}
            studentSection={studentSection}
            embedInDashboard
            sharedSectionData={sharedGroupsData}
            onSectionDataChange={() => void loadSectionData()}
          />
          <GroupRequestsPanel
            studentDatabaseId={studentDatabaseId}
            studentSection={studentSection}
            embedInDashboard
            sharedDiscoveryData={sharedDiscoveryData}
            onDiscoveryDataChange={() => void loadSectionData()}
          />
        </div>
      )}
    </div>,
  )
}
