"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"
import { UserPlus, Send, X, Check, MessageSquare, Search, Users, Globe, Zap, Star, Sparkles, Crown } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { GroupDiscoverPanelSkeleton } from "@/components/student/dashboard-v2/GroupsPageSkeleton"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"

const groupsTheme = getStudentModuleTheme("groups")

interface GroupRequestsPanelProps {
  studentDatabaseId: number
  studentSection: string
  embedInDashboard?: boolean
  sharedDiscoveryData?: {
    openGroups: OpenGroup[]
    studentsWithoutGroup: StudentWithoutGroup[]
    openCalls: OpenCall[]
    incomingJoinRequests: JoinRequest[]
    outgoingJoinRequests: JoinRequest[]
    incomingLinkRequests: LinkRequest[]
    outgoingLinkRequests: LinkRequest[]
    loading: boolean
  }
  onDiscoveryDataChange?: () => void
}

interface OpenGroup {
  id: number
  name: string
  session: string
  status: string
  leader_name: string
  member_count: number
}

interface StudentWithoutGroup {
  id: number
  student_id: string
  full_name: string
  section: string
}

interface OpenCall {
  id: number
  title: string
  message: string
  session: string
  created_at: string
  group_id: number | null
  owner_student_id: number | null
  group_name: string | null
  owner_name: string | null
}

interface JoinRequest {
  id: number
  status: string
  created_at: string
  group_id: number
  group_name: string
  requester_id?: number
  requester_name?: string
  requester_student_id?: string
  leader_name?: string
}

interface LinkRequest {
  id: number
  status: string
  created_at: string
  session: string
  from_student_id?: number
  from_student_name?: string
  from_student_student_id?: string
  to_student_id?: number
  to_student_name?: string
  to_student_student_id?: string
}

export function GroupRequestsPanel({
  studentDatabaseId,
  studentSection,
  embedInDashboard = false,
  sharedDiscoveryData,
  onDiscoveryDataChange,
}: GroupRequestsPanelProps) {
  const fp = getFacultyModuleTheme("groups").page
  const cardBase = PORTAL_CARD

  const { toast } = useToast()
  const [openGroups, setOpenGroups] = useState<OpenGroup[]>([])
  const [studentsWithoutGroup, setStudentsWithoutGroup] = useState<StudentWithoutGroup[]>([])
  const [openCalls, setOpenCalls] = useState<OpenCall[]>([])
  const [incomingJoinRequests, setIncomingJoinRequests] = useState<JoinRequest[]>([])
  const [outgoingJoinRequests, setOutgoingJoinRequests] = useState<JoinRequest[]>([])
  const [incomingLinkRequests, setIncomingLinkRequests] = useState<LinkRequest[]>([])
  const [outgoingLinkRequests, setOutgoingLinkRequests] = useState<LinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [createCallDialogOpen, setCreateCallDialogOpen] = useState(false)
  const [callTitle, setCallTitle] = useState("")
  const [callMessage, setCallMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (sharedDiscoveryData) {
      if (sharedDiscoveryData.loading) {
        setLoading(true)
        return
      }
      setOpenGroups(sharedDiscoveryData.openGroups)
      setStudentsWithoutGroup(sharedDiscoveryData.studentsWithoutGroup)
      setOpenCalls(sharedDiscoveryData.openCalls)
      setIncomingJoinRequests(sharedDiscoveryData.incomingJoinRequests)
      setOutgoingJoinRequests(sharedDiscoveryData.outgoingJoinRequests)
      setIncomingLinkRequests(sharedDiscoveryData.incomingLinkRequests)
      setOutgoingLinkRequests(sharedDiscoveryData.outgoingLinkRequests)
      setLoading(false)
      return
    }
    fetchDiscoveryData()
    fetchMyRequests()
  }, [
    studentSection,
    studentDatabaseId,
    sharedDiscoveryData?.loading,
    sharedDiscoveryData?.openGroups,
    sharedDiscoveryData?.studentsWithoutGroup,
    sharedDiscoveryData?.openCalls,
    sharedDiscoveryData?.incomingJoinRequests,
    sharedDiscoveryData?.outgoingJoinRequests,
    sharedDiscoveryData?.incomingLinkRequests,
    sharedDiscoveryData?.outgoingLinkRequests,
  ])

  const refreshDiscoveryData = async () => {
    if (sharedDiscoveryData && onDiscoveryDataChange) {
      onDiscoveryDataChange()
      return
    }
    await fetchDiscoveryData()
    await fetchMyRequests()
  }

  const fetchDiscoveryData = async () => {
    try {
      const params = buildStudentScopedSearchParams({ session: studentSection })
      const res = await fetch(`/api/groups/requests/discover?${params}`)
      const data = await res.json()
      if (data.ok) {
        setOpenGroups(data.data.openGroups || [])
        setStudentsWithoutGroup(data.data.studentsWithoutGroup || [])
        setOpenCalls(data.data.openCalls || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchMyRequests = async () => {
    try {
      const params = buildStudentScopedSearchParams({
        studentId: String(studentDatabaseId),
        session: studentSection,
      })
      const res = await fetch(`/api/groups/requests/my-requests?${params}`)
      const data = await res.json()
      if (data.ok) {
        setIncomingJoinRequests(data.data.incomingJoinRequests || [])
        setOutgoingJoinRequests(data.data.outgoingJoinRequests || [])
        setIncomingLinkRequests(data.data.incomingLinkRequests || [])
        setOutgoingLinkRequests(data.data.outgoingLinkRequests || [])
      }
    } catch {}
  }

  const handleJoinGroup = async (groupId: number) => {
    try {
      const res = await fetch("/api/groups/requests/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, requesterStudentId: studentDatabaseId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: "Join request sent successfully" })
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to send join request", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to send join request", variant: "destructive" })
    }
  }

  const handleRespondToJoinRequest = async (requestId: number, action: "accept" | "reject") => {
    try {
      const res = await fetch("/api/groups/requests/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, leaderId: studentDatabaseId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: data.data.message })
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to respond", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to respond to request", variant: "destructive" })
    }
  }

  const handleLinkStudent = async (toStudentId: number) => {
    try {
      const res = await fetch("/api/groups/requests/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStudentId: studentDatabaseId, toStudentId, session: studentSection }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: "Link request sent successfully" })
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to send link request", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to send link request", variant: "destructive" })
    }
  }

  const handleRespondToLinkRequest = async (requestId: number, action: "accept" | "reject") => {
    try {
      const res = await fetch("/api/groups/requests/link/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, responderId: studentDatabaseId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: data.data.message })
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to respond", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to respond to link request", variant: "destructive" })
    }
  }

  const handleCreateOpenCall = async () => {
    if (!callTitle.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/groups/requests/open-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: callTitle,
          message: callMessage,
          session: studentSection,
          ownerStudentId: studentDatabaseId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: "Open call created successfully" })
        setCallTitle("")
        setCallMessage("")
        setCreateCallDialogOpen(false)
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to create open call", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseOpenCall = async (openCallId: number) => {
    try {
      const res = await fetch("/api/groups/requests/open-call/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openCallId, studentId: studentDatabaseId }),
      })
      const data = await res.json()
      if (data.ok) {
        toast({ title: "Success", description: "Open call closed successfully" })
        refreshDiscoveryData()
      } else toast({ title: "Error", description: data.error || "Failed to close open call", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to close open call", variant: "destructive" })
    }
  }

  const filterGroups = (groups: OpenGroup[]) =>
    !searchQuery.trim()
      ? groups
      : groups.filter((g) =>
          [g.name, g.leader_name].some((x) => x.toLowerCase().includes(searchQuery.toLowerCase())),
        )

  const filterStudents = (students: StudentWithoutGroup[]) =>
    !searchQuery.trim()
      ? students
      : students.filter((s) =>
          [s.full_name, s.student_id].some((x) => x.toLowerCase().includes(searchQuery.toLowerCase())),
        )

  const filterOpenCalls = (calls: OpenCall[]) =>
    !searchQuery.trim()
      ? calls
      : calls.filter((c) =>
          [c.title, c.message, c.group_name, c.owner_name]
            .filter(Boolean)
            .some((x) => x!.toLowerCase().includes(searchQuery.toLowerCase())),
        )

  const primaryBtn =
    "bg-[#1E3A8A] text-white hover:bg-[#172c6b] rounded-full transition-all"
  const outlineBtn =
  "border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white hover:border-[#1E3A8A] rounded-full transition-all"

  if (loading) {
    if (embedInDashboard) {
      return <GroupDiscoverPanelSkeleton />
    }
    return (
      <div className="flex items-center justify-center min-h-[400px] rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700 border-t-emerald-500 dark:border-t-emerald-400" />
      </div>
    )
  }

  const cardClass = embedInDashboard
    ? "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-none"
    : "h-[600px] sm:h-[650px] md:h-[700px] border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-xl sm:rounded-2xl overflow-hidden"

  return (
    <Card className={cardClass}>
      <CardHeader className={cn(embedInDashboard ? "p-3 sm:p-4 pb-3" : "pb-3 sm:pb-4 p-4 sm:p-6")}>
        <CardTitle className={cn(
          embedInDashboard
            ? "text-sm font-semibold text-[var(--cc-text)]"
            : "text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3 text-slate-800 dark:text-slate-200",
        )}>
          {embedInDashboard ? "Discover" : (
            <>
          <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
            <Search className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
          </div>
          <span>
            <span className="sm:hidden">Discover</span>
            <span className="hidden sm:inline">Discovery Hub</span>
          </span>
            </>
          )}
        </CardTitle>
        <CardDescription className={cn(
          embedInDashboard ? "text-xs text-[var(--cc-text-muted)]" : "text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2",
        )}>
          {embedInDashboard ? "Open groups, requests, and calls" : (
            <>
          <span className="sm:hidden">Find groups & students</span>
          <span className="hidden sm:inline">Discover groups, connect with students, and manage requests</span>
            </>
          )}
        </CardDescription>
        <div className="pt-3 sm:pt-4">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "rounded-lg sm:rounded-xl w-full sm:max-w-md h-9 sm:h-10 text-sm sm:text-base placeholder:text-xs sm:placeholder:text-sm",
              embedInDashboard
                ? "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text)]"
                : "border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder:text-slate-500 focus:ring-emerald-500 dark:focus:ring-emerald-400",
            )}
            title="Search groups, students, or requests"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className={cn(
            "w-full rounded-xl mb-4 sm:mb-6 p-1 gap-0.5 sm:gap-1 grid grid-cols-3 h-10 sm:h-11 min-h-10 overflow-hidden",
            embedInDashboard
              ? "border border-[var(--border)] bg-[var(--muted)]/40"
              : "bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 dark:bg-slate-800/80 dark:border-slate-700/60",
          )}>
            <TabsTrigger value="discover" className={cn(
              "rounded-lg font-semibold min-w-0 overflow-hidden inline-flex items-center justify-center gap-1 px-1 sm:px-2",
              embedInDashboard ? "text-[11px] sm:text-xs data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white" : "text-xs sm:text-sm data-[state=active]:bg-emerald-500 dark:data-[state=active]:bg-emerald-600 data-[state=active]:text-white",
            )}>
              <Globe className={cn("shrink-0", embedInDashboard ? "h-3 w-3" : "h-3.5 w-3.5 sm:h-4 sm:w-4")} />
              <span className="truncate">Discover</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className={cn(
              "rounded-lg font-semibold min-w-0 overflow-hidden inline-flex items-center justify-center gap-1 px-1 sm:px-2",
              embedInDashboard ? "text-[11px] sm:text-xs data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white" : "text-xs sm:text-sm data-[state=active]:bg-purple-500 dark:data-[state=active]:bg-purple-600 data-[state=active]:text-white",
            )}>
              <Users className={cn("shrink-0", embedInDashboard ? "h-3 w-3" : "h-3.5 w-3.5 sm:h-4 sm:w-4")} />
              <span className="truncate">Requests</span>
            </TabsTrigger>
            <TabsTrigger value="open-calls" className={cn(
              "rounded-lg font-semibold min-w-0 overflow-hidden inline-flex items-center justify-center gap-1 px-1 sm:px-2",
              embedInDashboard ? "text-[11px] sm:text-xs data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white" : "text-xs sm:text-sm data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-blue-600 data-[state=active]:text-white",
            )}>
              <MessageSquare className={cn("shrink-0", embedInDashboard ? "h-3 w-3" : "h-3.5 w-3.5 sm:h-4 sm:w-4")} />
              {embedInDashboard ? (
                <span className="truncate">Calls</span>
              ) : (
                <>
                  <span className="hidden sm:inline truncate">Open Calls</span>
                  <span className="sm:hidden truncate">Calls</span>
                </>
              )}
            </TabsTrigger>
          </TabsList>

          {/* DISCOVER TAB */}
          <TabsContent value="discover" className="space-y-6 sm:space-y-8 overflow-y-auto max-h-[400px] sm:max-h-[450px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
            <section>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg shrink-0",
                  embedInDashboard ? groupsTheme.page.iconBg : "bg-blue-100 dark:bg-blue-900/50"
                )}>
                  <Users className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5",
                    embedInDashboard ? groupsTheme.page.iconText : "text-blue-600 dark:text-blue-400"
                  )} />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                  <span className="sm:hidden">Groups</span>
                  <span className="hidden sm:inline">Available Groups</span>
                </h4>
              </div>
              {filterGroups(openGroups).length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700 w-fit mx-auto mb-3 sm:mb-4">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">No groups available.</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filterGroups(openGroups).map((g, index) => (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className={cn(
                        embedInDashboard
                          ? "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-none"
                          : "border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300",
                      )}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                              <h5 className={cn(
                                "break-words",
                                embedInDashboard ? "text-sm font-semibold text-[var(--cc-text)]" : "font-bold text-slate-800 dark:text-slate-200 text-base sm:text-lg",
                              )}>{g.name}</h5>
                              <Badge className="bg-amber-500 dark:bg-amber-600 text-white border-0 px-2 py-0.5 sm:py-1 rounded-full text-xs w-fit">
                                <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                Leader
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                              <span className="sm:hidden">
                                {g.leader_name.split(' ')[0]} • {g.member_count}
                              </span>
                              <span className="hidden sm:inline">
                                Led by {g.leader_name} • {g.member_count} members
                              </span>
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            className={cn(
                              "rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto shrink-0",
                              embedInDashboard
                                ? "h-9 border-0 shadow-none hover:opacity-90"
                                : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.4)] transition-all duration-300",
                            )}
                            style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
                            onClick={() => handleJoinGroup(g.id)}
                          >
                            <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Request
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg shrink-0",
                  embedInDashboard ? groupsTheme.page.iconBg : "bg-purple-100 dark:bg-purple-900/50"
                )}>
                  <Star className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5",
                    embedInDashboard ? groupsTheme.page.iconText : "text-purple-600 dark:text-purple-400"
                  )} />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                  <span className="sm:hidden">Students</span>
                  <span className="hidden sm:inline">Students Looking for Group</span>
                </h4>
              </div>
              {filterStudents(studentsWithoutGroup.filter((s) => s.id !== studentDatabaseId)).length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700 w-fit mx-auto mb-3 sm:mb-4">
                    <Star className="h-6 w-6 sm:h-8 sm:w-8 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">No available students found.</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filterStudents(studentsWithoutGroup.filter((s) => s.id !== studentDatabaseId)).map((s, index) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-base sm:text-lg break-words">{s.full_name}</h5>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn(
                              "rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto shrink-0 transition-all duration-300",
                              embedInDashboard
                                ? portalOutlineButtonClass(groupsTheme)
                                : "border border-purple-500 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-500 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white",
                            )}
                            onClick={() => handleLinkStudent(s.id)}
                          >
                            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Link
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* OPEN CALLS TAB */}
          <TabsContent value="open-calls" className="space-y-4 sm:space-y-6 overflow-y-auto max-h-[400px] sm:max-h-[450px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
            <Button 
              className={cn(
                "rounded-lg sm:rounded-xl w-full mb-3 sm:mb-4 px-4 sm:px-6 py-2 sm:py-3 font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base h-10 sm:h-11",
                embedInDashboard
                  ? "border-0 shadow-none hover:opacity-90"
                  : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all duration-300",
              )}
              style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
              onClick={() => setCreateCallDialogOpen(true)}
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sm:hidden">Create Call</span>
              <span className="hidden sm:inline">Create Open Call</span>
            </Button>

            {filterOpenCalls(openCalls).length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700 w-fit mx-auto mb-3 sm:mb-4">
                  <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">No open calls found</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filterOpenCalls(openCalls).map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
                      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-base sm:text-lg break-words">{c.title}</h5>
                            <Badge className={cn(
                              "text-white border-0 px-2 py-0.5 sm:py-1 rounded-full text-xs w-fit",
                              embedInDashboard ? "bg-[var(--cc-accent)]" : "bg-blue-500 dark:bg-blue-600",
                            )}>
                              <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                              Open Call
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-1 sm:mb-2 break-words">
                            {c.group_name ? (
                              <>
                                <span className="sm:hidden">{c.group_name}</span>
                                <span className="hidden sm:inline">Group: {c.group_name}</span>
                              </>
                            ) : (
                              <>
                                <span className="sm:hidden">{c.owner_name?.split(' ')[0]}</span>
                                <span className="hidden sm:inline">By: {c.owner_name}</span>
                              </>
                            )}
                          </p>
                          {c.message && <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 break-words">{c.message}</p>}
                        </div>
                        {c.owner_student_id === studentDatabaseId && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border border-red-500 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-500 dark:hover:bg-red-600 hover:text-white dark:hover:text-white rounded-lg sm:rounded-xl transition-all duration-300 px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-xs sm:text-sm w-full sm:w-auto shrink-0" 
                            onClick={() => handleCloseOpenCall(c.id)}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={createCallDialogOpen} onOpenChange={setCreateCallDialogOpen}>
        <DialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] w-[calc(100%-2rem)] sm:w-full max-w-lg">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
              <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", embedInDashboard ? groupsTheme.page.iconBg : "bg-blue-100 dark:bg-blue-900/50")}>
                <MessageSquare className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? groupsTheme.page.iconText : "text-blue-600 dark:text-blue-400")} />
              </div>
              <span>
                <span className="sm:hidden">New Call</span>
                <span className="hidden sm:inline">Create Open Call</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span className="sm:hidden">Find group members</span>
              <span className="hidden sm:inline">Let others know you're looking for group members</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4 px-4 sm:px-6">
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="callTitle" className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Title</Label>
              <Input
                id="callTitle"
                placeholder="e.g., Looking for 2 members"
                value={callTitle}
                onChange={(e) => setCallTitle(e.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "rounded-lg sm:rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder:text-slate-500 h-9 sm:h-10 text-sm sm:text-base",
                  embedInDashboard ? "focus-visible:ring-2 focus-visible:ring-amber-500/30" : "focus:ring-blue-500 dark:focus:ring-blue-400",
                )}
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="callMessage" className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Message (Optional)</Label>
              <Textarea
                id="callMessage"
                placeholder="Add details..."
                value={callMessage}
                onChange={(e) => setCallMessage(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className={cn(
                  "rounded-lg sm:rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder:text-slate-500 text-sm sm:text-base",
                  embedInDashboard ? "focus-visible:ring-2 focus-visible:ring-amber-500/30" : "focus:ring-blue-500 dark:focus:ring-blue-400",
                )}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setCreateCallDialogOpen(false)} 
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 dark:text-slate-300 text-xs sm:text-sm w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOpenCall} 
              disabled={isSubmitting}
              className={cn(
                "rounded-lg sm:rounded-xl px-4 sm:px-6 py-2 font-semibold text-xs sm:text-sm w-full sm:w-auto",
                embedInDashboard
                  ? groupsTheme.page.cta
                  : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all duration-300",
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Creating...</span>
                  <span className="sm:hidden">Creating</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Create
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
