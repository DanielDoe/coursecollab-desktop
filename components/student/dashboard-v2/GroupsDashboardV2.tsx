"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"

const GroupsManager = dynamic(
  () => import("@/components/groups-manager").then((m) => ({ default: m.GroupsManager })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

const GroupRequestsPanel = dynamic(
  () => import("@/components/group-requests-panel").then((m) => ({ default: m.GroupRequestsPanel })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[240px]" /> },
)

type SectionGroup = {
  id: number
  name: string
  session: string
  created_by: number
  leader_name: string
  leader_student_id: string
  member_count: number
  status: "pending" | "approved" | "rejected" | "pending_update"
  members: Array<{
    id: number
    student_id: string
    full_name: string
    joined_at: string
  }>
}

type SectionStudent = {
  id: number
  student_id: string
  full_name: string
  section: string
}

export function GroupsDashboardV2() {
  const router = useRouter()
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)
  const [studentSection, setStudentSection] = useState("")
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<SectionGroup[]>([])
  const [students, setStudents] = useState<SectionStudent[]>([])
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
        fetch(`/api/groups?${groupParams}`, {
          headers: { "x-student-id": String(studentDatabaseId) },
        }),
        studentApiFetch(`/api/student/roster?${rosterParams}`),
        fetch(`/api/groups/requests/discover?${discoverParams}`, {
          headers: { "x-student-id": String(studentDatabaseId) },
        }),
        fetch(`/api/groups/requests/my-requests?${myReqParams}`, {
          headers: { "x-student-id": String(studentDatabaseId) },
        }),
      ])

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups ?? [])
      } else setGroups([])

      if (rosterRes.ok) {
        const data = await rosterRes.json()
        setStudents(
          (data.students ?? []).map((s: SectionStudent) => ({
            ...s,
            section: studentSection,
          })),
        )
      } else setStudents([])

      if (discoverRes.ok) {
        const data = await discoverRes.json()
        if (data.ok) {
          setDiscovery({
            openGroups: data.data?.openGroups ?? [],
            studentsWithoutGroup: data.data?.studentsWithoutGroup ?? [],
            openCalls: data.data?.openCalls ?? [],
          })
        } else setDiscovery({ openGroups: [], studentsWithoutGroup: [], openCalls: [] })
      } else setDiscovery({ openGroups: [], studentsWithoutGroup: [], openCalls: [] })

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
    () => ({ ...discovery, ...requests, loading: false as const }),
    [discovery, requests],
  )

  const requestCount = useMemo(() => {
    return (
      requests.incomingJoinRequests.length +
      requests.outgoingJoinRequests.length +
      requests.incomingLinkRequests.length +
      requests.outgoingLinkRequests.length
    )
  }, [requests])

  if (!mounted || !studentDatabaseId || !studentSection) {
    return (
      <StudentModuleHubLayout
        moduleId="groups"
        title="Groups"
        metaLine="Loading section…"
        hideSideMenu
        scrollMode="panel"
        menuView="groups"
        onMenuSelect={() => {}}
        menuItems={[]}
        loading
      >
        {null}
      </StudentModuleHubLayout>
    )
  }

  const metaLine = loading ? (
    <span className="inline-block h-4 w-48 animate-pulse rounded bg-[var(--muted)]" />
  ) : (
    <>
      Section {studentSection} · {groups.length} group{groups.length === 1 ? "" : "s"}
      {requestCount > 0 ? ` · ${requestCount} pending` : ""}
    </>
  )

  return (
    <StudentModuleHubLayout
      moduleId="groups"
      title="Groups"
      metaLine={metaLine}
      metaSuffix="propose or join a group that's open"
      hideSideMenu
      scrollMode="panel"
      menuView="groups"
      onMenuSelect={() => {}}
      menuItems={[]}
      loading={loading}
    >
      <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3 lg:items-stretch">
        <div className="flex h-full min-h-0 min-w-0 flex-col lg:col-span-2">
          <GroupsManager
            studentDatabaseId={studentDatabaseId}
            studentSection={studentSection}
            embedInDashboard
            sharedSectionData={sharedGroupsData}
            onSectionDataChange={() => void loadSectionData()}
          />
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <GroupRequestsPanel
            studentDatabaseId={studentDatabaseId}
            studentSection={studentSection}
            embedInDashboard
            sharedDiscoveryData={sharedDiscoveryData}
            onDiscoveryDataChange={() => void loadSectionData()}
          />
        </div>
      </div>
    </StudentModuleHubLayout>
  )
}
